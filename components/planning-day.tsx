"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import type { SerializedItem } from "@/lib/schedule";

const HAUTEUR_HEURE = 56; // px pour une heure
const LARGEUR_COLONNE = 120; // px : largeur de base d'un agenda
const HAUTEUR_ENTETE = 46; // px : bandeau des noms

export interface DayColumn {
  id: string;
  nom: string;
}

export interface DaySlotClick {
  date: string;
  heureDebut: string;
  heureFin: string;
  workerId: string;
}

function minutes(hhmmStr: string): number {
  const [h, m] = hhmmStr.split(":").map(Number);
  return h * 60 + (m || 0);
}
function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  return `${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Texte clair ou foncé selon la luminance du fond : certaines activités sont
 * très sombres (Anesthésie #7030A0) et le texte foncé y était illisible.
 */
function texteSur(fond: string): string {
  const hex = fond.replace("#", "");
  if (hex.length !== 6) return "#0f172a";
  const canal = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(canal(0)) + 0.7152 * lin(canal(2)) + 0.0722 * lin(canal(4));
  return L > 0.45 ? "#0f172a" : "#ffffff";
}

// Pastille de couleur stable par personne (repère visuel en tête de colonne).
function pastille(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 58% 45%)`;
}

/**
 * Place les créneaux qui se chevauchent côte à côte dans leur colonne : on
 * regroupe les créneaux qui se recouvrent, puis on répartit chaque groupe sur
 * autant de voies que nécessaire.
 */
function repartir(items: SerializedItem[]) {
  const tries = [...items].sort(
    (a, b) =>
      minutes(a.heureDebut) - minutes(b.heureDebut) || minutes(a.heureFin) - minutes(b.heureFin),
  );
  const places: { item: SerializedItem; voie: number; voies: number }[] = [];
  let paquet: { item: SerializedItem; voie: number }[] = [];
  let finsVoies: number[] = [];

  const vider = () => {
    for (const p of paquet) places.push({ ...p, voies: finsVoies.length });
    paquet = [];
    finsVoies = [];
  };

  for (const it of tries) {
    const debut = minutes(it.heureDebut);
    // Plus aucun chevauchement avec le groupe en cours : on le clôture.
    if (finsVoies.length && Math.max(...finsVoies) <= debut) vider();
    let voie = finsVoies.findIndex((fin) => fin <= debut);
    if (voie === -1) {
      voie = finsVoies.length;
      finsVoies.push(0);
    }
    finsVoies[voie] = minutes(it.heureFin);
    paquet.push({ item: it, voie });
  }
  vider();
  return places;
}

/**
 * Vue « Jour » : une colonne par vétérinaire, les heures en vertical, chaque
 * créneau dessiné à sa place et à sa durée réelles. C'est la lecture la plus
 * proche de l'agenda de la clinique : d'un coup d'œil on voit qui est là à
 * 14 h et où sont les trous de la journée.
 */
export function PlanningDay({
  items,
  date,
  workers,
  onEventClick,
  onSlotClick,
}: {
  items: SerializedItem[];
  date: string; // "AAAA-MM-JJ"
  workers?: DayColumn[]; // colonnes imposées (sinon déduites des créneaux)
  onEventClick?: (it: SerializedItem) => void;
  onSlotClick?: (d: DaySlotClick) => void;
}) {
  const [journeeEntiere, setJourneeEntiere] = useState(false);
  const [maintenant, setMaintenant] = useState(() => new Date());

  // Le trait « il est telle heure » ne doit pas se figer sur une page ouverte.
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const jour = useMemo(() => items.filter((it) => it.date === date), [items, date]);

  // Colonnes : celles demandées, complétées par toute personne planifiée ce
  // jour-là qui n'y figure pas (ex. compte désactivé mais encore au planning).
  const colonnes = useMemo<DayColumn[]>(() => {
    const base = workers ? [...workers] : [];
    const connus = new Set(base.map((w) => w.id));
    const extra = new Map<string, string>();
    for (const it of jour) {
      if (it.workerId && !connus.has(it.workerId)) extra.set(it.workerId, it.workerNom ?? "—");
    }
    for (const [id, nom] of extra) base.push({ id, nom });
    if (!workers) base.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return base;
  }, [workers, jour]);

  // Plage horaire affichée : celle des créneaux du jour, élargie à 08:00-20:00
  // au minimum pour que la grille reste lisible quand la journée est creuse.
  const [heureMin, heureMax] = useMemo(() => {
    if (journeeEntiere) return [0, 24];
    if (jour.length === 0) return [8, 20];
    let min = 24 * 60;
    let max = 0;
    for (const it of jour) {
      min = Math.min(min, minutes(it.heureDebut));
      max = Math.max(max, minutes(it.heureFin));
    }
    return [Math.min(8, Math.floor(min / 60)), Math.max(20, Math.ceil(max / 60))];
  }, [jour, journeeEntiere]);

  const heures = Array.from({ length: heureMax - heureMin }, (_, i) => heureMin + i);
  const hauteur = heures.length * HAUTEUR_HEURE;
  const debutMin = heureMin * 60;

  const parPersonne = useMemo(() => {
    const m = new Map<string, SerializedItem[]>();
    for (const it of jour) {
      if (!it.workerId) continue;
      const arr = m.get(it.workerId) ?? [];
      arr.push(it);
      m.set(it.workerId, arr);
    }
    return m;
  }, [jour]);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nowMin = maintenant.getHours() * 60 + maintenant.getMinutes();
  const nowTop =
    date === aujourdhui && nowMin >= debutMin && nowMin <= heureMax * 60
      ? ((nowMin - debutMin) / 60) * HAUTEUR_HEURE
      : null;

  if (colonnes.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Aucun créneau ce jour-là.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {jour.length} créneau{jour.length > 1 ? "x" : ""} · {colonnes.length} agenda
          {colonnes.length > 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setJourneeEntiere(!journeeEntiere)}
          className="flex items-center gap-1.5 rounded border border-border px-2 py-1 hover:bg-muted"
        >
          <Clock3 className="h-3.5 w-3.5" />
          {journeeEntiere ? "Heures utiles" : "Journée entière (00 h – 24 h)"}
        </button>
      </div>

      <div className="max-h-[78vh] overflow-auto rounded-md border border-border bg-card">
        <div className="flex">
          {/* Gouttière des heures : reste visible pendant le défilement latéral. */}
          <div className="sticky left-0 z-30 w-12 shrink-0 bg-card">
            <div
              className="sticky top-0 z-30 border-b border-r border-border bg-muted"
              style={{ height: HAUTEUR_ENTETE }}
            />
            <div className="relative border-r border-border" style={{ height: hauteur }}>
              {heures.map((h) => (
                <div
                  key={h}
                  className="relative border-t border-border"
                  style={{ height: HAUTEUR_HEURE }}
                >
                  <span className="absolute right-1 top-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {String(h % 24).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
              {nowTop !== null && (
                <span
                  className="absolute right-0 z-10 -translate-y-1/2 rounded-l bg-danger px-1 text-[10px] font-semibold tabular-nums text-white"
                  style={{ top: nowTop }}
                >
                  {hhmm(nowMin)}
                </span>
              )}
            </div>
          </div>

          {/* Une colonne par agenda. */}
          {colonnes.map((col) => {
            const places = repartir(parPersonne.get(col.id) ?? []);
            return (
              <div
                key={col.id}
                className="border-r border-border last:border-r-0"
                style={{ flex: `1 0 ${LARGEUR_COLONNE}px` }}
              >
                <div
                  className="sticky top-0 z-20 flex items-center gap-1 overflow-hidden border-b border-border bg-muted px-1.5"
                  style={{ height: HAUTEUR_ENTETE }}
                  title={col.nom}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: pastille(col.id) }}
                  />
                  <span className="truncate text-xs font-semibold">{col.nom}</span>
                </div>

                <div className="relative" style={{ height: hauteur }}>
                  {/* Trait de l'heure courante, repris dans chaque colonne pour
                      qu'il reste aligné quel que soit le défilement. */}
                  {nowTop !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger"
                      style={{ top: nowTop }}
                    />
                  )}
                  {/* Lignes horaires, cliquables pour créer un créneau. */}
                  {heures.map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={!onSlotClick}
                      onClick={() =>
                        onSlotClick?.({
                          date,
                          heureDebut: hhmm(h * 60),
                          heureFin: hhmm(Math.min((h + 1) * 60, 23 * 60 + 59)),
                          workerId: col.id,
                        })
                      }
                      className="block w-full border-t border-border/70 enabled:hover:bg-primary/5"
                      style={{ height: HAUTEUR_HEURE }}
                    />
                  ))}

                  {/* Créneaux, posés à leur heure et à leur durée réelles. */}
                  {places.map(({ item: it, voie, voies }) => {
                    const haut = ((minutes(it.heureDebut) - debutMin) / 60) * HAUTEUR_HEURE;
                    const h =
                      ((minutes(it.heureFin) - minutes(it.heureDebut)) / 60) * HAUTEUR_HEURE;
                    const fond = it.activityCouleur || it.roomCouleur || "#e2e8f0";
                    const compact = h < 34;
                    const libelle = it.activityNom ?? it.titre ?? "";
                    return (
                      <button
                        key={it.id}
                        onClick={() => onEventClick?.(it)}
                        title={`${it.heureDebut}–${it.heureFin} · ${libelle}${it.roomNom ? ` · ${it.roomNom}` : ""}`}
                        /* flex-col : sans cela le navigateur centre le contenu
                           d'un bouton verticalement, et le libellé flottait au
                           milieu des créneaux longs au lieu d'être en haut. */
                        className="absolute flex flex-col items-stretch overflow-hidden rounded px-1 text-left leading-tight shadow-sm ring-1 ring-black/5 transition hover:z-10 hover:ring-2 hover:ring-foreground/30"
                        style={{
                          top: haut,
                          height: Math.max(h, 16),
                          left: `calc(${(voie / voies) * 100}% + 2px)`,
                          width: `calc(${100 / voies}% - 4px)`,
                          backgroundColor: fond,
                          color: texteSur(fond),
                          borderLeft: it.roomCouleur ? `3px solid ${it.roomCouleur}` : undefined,
                          paddingTop: compact ? 0 : 2,
                        }}
                      >
                        {compact ? (
                          <span className="block truncate text-[10px]">
                            <span className="font-semibold tabular-nums">{it.heureDebut}</span>{" "}
                            {libelle}
                          </span>
                        ) : (
                          <>
                            <span className="block text-[10px] font-semibold tabular-nums">
                              {it.heureDebut}–{it.heureFin}
                            </span>
                            <span className="block text-[11px]">{libelle}</span>
                            {it.roomNom && h > 60 && (
                              <span className="block text-[10px] opacity-75">{it.roomNom}</span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
