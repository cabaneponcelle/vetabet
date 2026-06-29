// ─────────────────────────────────────────────────────────────────────────────
//  Moteur de détection des incohérences du planning.
//
//  Fonction PURE et TESTABLE : aucune dépendance à la base de données ni au
//  réseau. On lui passe la liste des créneaux + les infos travailleurs/salles,
//  elle renvoie la liste des conflits détectés. Utilisée à la fois pour :
//    • alimenter le panneau d'alertes du tableau de bord RH ;
//    • bloquer la publication tant qu'il reste des conflits « bloquants ».
// ─────────────────────────────────────────────────────────────────────────────

export type ConflictSeverity = "BLOQUANT" | "AVERTISSEMENT";

export type ConflictType =
  | "HORAIRE_INVALIDE" // heure de fin <= heure de début
  | "INCOMPLET" // salle ou travailleur manquant
  | "SALLE_DESACTIVEE" // créneau sur une salle désactivée
  | "TRAVAILLEUR_DESACTIVE" // créneau sur un travailleur désactivé
  | "HORS_DISPO" // travailleur planifié hors de ses disponibilités
  | "SALLE_OCCUPEE" // 2 créneaux dans la même salle au même moment
  | "TRAVAILLEUR_DOUBLE" // 1 travailleur à 2 endroits au même moment
  | "SUR_CONGE"; // travailleur planifié pendant un congé approuvé

export interface ConflictItem {
  id: string;
  date: string; // "YYYY-MM-DD"
  heureDebut: string; // "HH:mm"
  heureFin: string; // "HH:mm"
  workerId: string | null;
  workerNom?: string | null;
  roomId: string | null;
  roomNom?: string | null;
  activityNom?: string | null;
}

export interface WorkerInfo {
  id: string;
  nom: string;
  actif: boolean;
  // disponibilités récurrentes ; vide = aucune contrainte de dispo
  availabilities: { jourSemaine: number; heureDebut: string; heureFin: string }[];
}

export interface RoomInfo {
  id: string;
  nom: string;
  actif: boolean;
}

export interface Conflict {
  type: ConflictType;
  severite: ConflictSeverity;
  message: string;
  date: string;
  heure: string; // "HH:mm–HH:mm"
  travailleur?: string | null;
  salle?: string | null;
  itemIds: string[]; // créneaux impliqués (1 ou 2)
}

// "HH:mm" -> nombre de minutes depuis minuit. Renvoie NaN si invalide.
export function timeToMinutes(t: string): number {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return NaN;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Deux intervalles se chevauchent si : startA < endB ET endA > startB.
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  if ([as, ae, bs, be].some(Number.isNaN)) return false;
  return as < be && ae > bs;
}

// "YYYY-MM-DD" -> 0 (lundi) … 6 (dimanche). Robuste au fuseau (parse manuel).
export function dayOfWeekMonday0(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = dimanche … 6 = samedi
  return (js + 6) % 7; // décale pour 0 = lundi
}

// Le créneau est-il entièrement contenu dans au moins une plage de dispo du jour ?
function dansDisponibilites(item: ConflictItem, worker: WorkerInfo): boolean {
  // Pas de dispo renseignée => on ne contraint pas (toujours « disponible »).
  if (!worker.availabilities || worker.availabilities.length === 0) return true;
  const jour = dayOfWeekMonday0(item.date);
  const debut = timeToMinutes(item.heureDebut);
  const fin = timeToMinutes(item.heureFin);
  return worker.availabilities.some((a) => {
    if (a.jourSemaine !== jour) return false;
    return timeToMinutes(a.heureDebut) <= debut && timeToMinutes(a.heureFin) >= fin;
  });
}

function plage(item: ConflictItem): string {
  return `${item.heureDebut}–${item.heureFin}`;
}

function dateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Détecte toutes les incohérences d'un ensemble de créneaux.
 * @param items   créneaux à analyser
 * @param workers infos travailleurs (par id)
 * @param rooms   infos salles (par id)
 */
export function detectConflicts(
  items: ConflictItem[],
  workers: WorkerInfo[],
  rooms: RoomInfo[],
): Conflict[] {
  const conflicts: Conflict[] = [];
  const workerById = new Map(workers.map((w) => [w.id, w]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  // ── 1) Contrôles par créneau (un seul créneau) ────────────────────────────
  for (const it of items) {
    const worker = it.workerId ? workerById.get(it.workerId) : undefined;
    const room = it.roomId ? roomById.get(it.roomId) : undefined;
    const wNom = it.workerNom ?? worker?.nom ?? null;
    const rNom = it.roomNom ?? room?.nom ?? null;

    // Horaire invalide : fin <= début
    if (timeToMinutes(it.heureFin) <= timeToMinutes(it.heureDebut)) {
      conflicts.push({
        type: "HORAIRE_INVALIDE",
        severite: "BLOQUANT",
        message: `Horaire invalide le ${dateFr(it.date)} : l'heure de fin (${it.heureFin}) est avant ou égale à l'heure de début (${it.heureDebut}).`,
        date: it.date,
        heure: plage(it),
        travailleur: wNom,
        salle: rNom,
        itemIds: [it.id],
      });
    }

    // Créneau incomplet : travailleur manquant (la salle est optionnelle —
    // le planning issu de l'Excel encode les activités sans salle dédiée).
    if (!it.workerId) {
      conflicts.push({
        type: "INCOMPLET",
        severite: "BLOQUANT",
        message: `Créneau sans travailleur le ${dateFr(it.date)} de ${plage(it)}.`,
        date: it.date,
        heure: plage(it),
        travailleur: wNom,
        salle: rNom,
        itemIds: [it.id],
      });
    }

    // Salle désactivée
    if (room && !room.actif) {
      conflicts.push({
        type: "SALLE_DESACTIVEE",
        severite: "BLOQUANT",
        message: `La salle « ${room.nom} » est désactivée mais utilisée le ${dateFr(it.date)} de ${plage(it)}.`,
        date: it.date,
        heure: plage(it),
        travailleur: wNom,
        salle: room.nom,
        itemIds: [it.id],
      });
    }

    // Travailleur désactivé
    if (worker && !worker.actif) {
      conflicts.push({
        type: "TRAVAILLEUR_DESACTIVE",
        severite: "BLOQUANT",
        message: `${worker.nom} est désactivé(e) mais planifié(e) le ${dateFr(it.date)} de ${plage(it)}.`,
        date: it.date,
        heure: plage(it),
        travailleur: worker.nom,
        salle: rNom,
        itemIds: [it.id],
      });
    }

    // Hors disponibilités (avertissement)
    if (worker && worker.actif && !dansDisponibilites(it, worker)) {
      conflicts.push({
        type: "HORS_DISPO",
        severite: "AVERTISSEMENT",
        message: `${worker.nom} est planifié(e) le ${dateFr(it.date)} de ${plage(it)}, en dehors de ses disponibilités déclarées.`,
        date: it.date,
        heure: plage(it),
        travailleur: worker.nom,
        salle: rNom,
        itemIds: [it.id],
      });
    }
  }

  // ── 2) Contrôles par paire (même date, horaires qui se chevauchent) ────────
  const byDate = new Map<string, ConflictItem[]>();
  for (const it of items) {
    const arr = byDate.get(it.date) ?? [];
    arr.push(it);
    byDate.set(it.date, arr);
  }

  for (const [date, dayItems] of byDate) {
    for (let i = 0; i < dayItems.length; i++) {
      for (let j = i + 1; j < dayItems.length; j++) {
        const a = dayItems[i];
        const b = dayItems[j];
        if (!overlaps(a.heureDebut, a.heureFin, b.heureDebut, b.heureFin)) continue;

        // Même salle occupée deux fois
        if (a.roomId && b.roomId && a.roomId === b.roomId) {
          const nom = a.roomNom ?? roomById.get(a.roomId)?.nom ?? "?";
          conflicts.push({
            type: "SALLE_OCCUPEE",
            severite: "BLOQUANT",
            message: `La salle « ${nom} » est déjà occupée le ${dateFr(date)} de ${plage(a)} (chevauchement avec ${plage(b)}).`,
            date,
            heure: plage(a),
            salle: nom,
            travailleur: null,
            itemIds: [a.id, b.id],
          });
        }

        // Même travailleur à deux endroits
        if (a.workerId && b.workerId && a.workerId === b.workerId) {
          const nom = a.workerNom ?? workerById.get(a.workerId)?.nom ?? "?";
          const aConge = a.activityNom === "Congé";
          const bConge = b.activityNom === "Congé";
          if (aConge !== bConge) {
            // L'un des deux est un congé → planifié pendant un congé.
            const autre = aConge ? b : a;
            conflicts.push({
              type: "SUR_CONGE",
              severite: "BLOQUANT",
              message: `${nom} est en congé le ${dateFr(date)} mais reste planifié(e) (${autre.activityNom ?? "activité"}) de ${plage(autre)}.`,
              date,
              heure: plage(autre),
              travailleur: nom,
              salle: autre.roomNom ?? null,
              itemIds: [a.id, b.id],
            });
          } else {
            conflicts.push({
              type: "TRAVAILLEUR_DOUBLE",
              severite: "BLOQUANT",
              message: `${nom} est planifié(e) à deux endroits le ${dateFr(date)} de ${plage(a)} (chevauchement avec ${plage(b)}).`,
              date,
              heure: plage(a),
              travailleur: nom,
              salle: null,
              itemIds: [a.id, b.id],
            });
          }
        }
      }
    }
  }

  return conflicts;
}

// Raccourci : ne reste-t-il que des avertissements (=> publication autorisée) ?
export function hasBlocking(conflicts: Conflict[]): boolean {
  return conflicts.some((c) => c.severite === "BLOQUANT");
}
