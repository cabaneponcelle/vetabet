"use client";

import type { SerializedItem } from "@/lib/schedule";

const JOURS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}
function ddmm(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

/**
 * Vue « Grille » plein écran : une ligne par vétérinaire, une colonne par jour
 * de la semaine. Chaque cellule liste les créneaux du véto (fond = activité,
 * liséré = salle). Bien plus lisible que le calendrier quand tout le monde est
 * affiché sur une semaine.
 */
export function PlanningGrid({
  items,
  weekMonday,
  onEventClick,
}: {
  items: SerializedItem[];
  weekMonday: string;
  onEventClick?: (it: SerializedItem) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));
  const weekEnd = days[6];

  // Créneaux de la semaine affichée.
  const weekItems = items.filter((it) => it.date >= weekMonday && it.date <= weekEnd);

  // Vétos présents cette semaine, triés par nom.
  const workerMap = new Map<string, string>();
  for (const it of weekItems) {
    if (it.workerId) workerMap.set(it.workerId, it.workerNom ?? "—");
  }
  const workers = [...workerMap.entries()]
    .map(([id, nom]) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  // Index (workerId|date) -> créneaux triés par heure.
  const byCell = new Map<string, SerializedItem[]>();
  for (const it of weekItems) {
    if (!it.workerId) continue;
    const key = `${it.workerId}|${it.date}`;
    const arr = byCell.get(key) ?? [];
    arr.push(it);
    byCell.set(key, arr);
  }
  for (const arr of byCell.values()) arr.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));

  if (workers.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucun créneau pour cette semaine.
      </p>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    // overflow-auto + hauteur max : permet aux en-têtes (haut et gauche) de
    // rester visibles pendant le défilement de la grille.
    <div className="max-h-[75vh] overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border border-border bg-muted px-2 py-1.5 text-left font-semibold">
              Vétérinaire
            </th>
            {days.map((d, i) => (
              <th
                key={d}
                className={`sticky top-0 z-20 min-w-[150px] border border-border px-2 py-1.5 text-center font-semibold ${
                  d === today ? "bg-primary/15 text-primary" : "bg-muted"
                }`}
              >
                {JOURS[i]} {ddmm(d)}
                {d === today && <span className="block text-[10px] font-normal">Aujourd&apos;hui</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.id} className="hover:bg-muted/30">
              <th className="sticky left-0 z-10 whitespace-nowrap border border-border bg-card px-2 py-1 text-left font-medium">
                {w.nom}
              </th>
              {days.map((d) => {
                const cell = byCell.get(`${w.id}|${d}`) ?? [];
                return (
                  <td key={d} className={`border border-border align-top p-1 ${d === today ? "bg-primary/5" : ""}`}>
                    <div className="flex flex-col gap-1">
                      {cell.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => onEventClick?.(it)}
                          title={`${it.heureDebut}–${it.heureFin} · ${it.activityNom ?? it.titre ?? ""}${it.roomNom ? ` · ${it.roomNom}` : ""}`}
                          className="w-full rounded px-1.5 py-0.5 text-left leading-tight"
                          style={{
                            backgroundColor: it.activityCouleur || it.roomCouleur || "#e2e8f0",
                            borderLeft: `4px solid ${it.roomCouleur || it.activityCouleur || "#94a3b8"}`,
                            color: "#0f172a",
                          }}
                        >
                          <span className="font-semibold">{it.heureDebut}–{it.heureFin}</span>{" "}
                          <span>{it.activityNom ?? it.titre ?? ""}</span>
                          {it.roomNom && <span className="block opacity-70">{it.roomNom}</span>}
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
