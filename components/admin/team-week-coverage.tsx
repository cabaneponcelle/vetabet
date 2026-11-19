"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { texteSur } from "@/lib/couleurs";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SEMAINES = [1, 2, 3, 4];

interface Slot {
  id: string;
  workerId: string;
  workerNom: string | null;
  semaine: number;
  jour: number;
  heureDebut: string;
  heureFin: string;
  activityNom: string | null;
  activityCouleur: string | null;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const SANS = "Sans activité";

/**
 * Couverture de l'équipe sur une semaine type : qui travaille quoi, chaque
 * jour. Répond à la question que la grille par personne ne permet pas de
 * poser — « le lundi en S1, ai-je assez de monde en consultation, et pas trop
 * en chirurgie ? » — en montrant, pour chaque activité et chaque jour, le
 * nombre de vétérinaires et leurs horaires.
 */
export function TeamWeekCoverage({
  semaine,
  prochainLundi,
  enCours,
}: {
  semaine: number;
  prochainLundi?: string;
  enCours: boolean;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let vivant = true;
    fetch("/api/semaines-types")
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((j) => {
        if (vivant) setSlots(j.slots ?? []);
      })
      .finally(() => vivant && setCharge(true));
    return () => {
      vivant = false;
    };
  }, []);

  const deLaSemaine = useMemo(() => slots.filter((s) => s.semaine === semaine), [slots, semaine]);

  // Activité -> jour -> créneaux, pour un tableau activités × jours.
  const parActivite = useMemo(() => {
    const m = new Map<string, { couleur: string | null; jours: Slot[][] }>();
    for (const s of deLaSemaine) {
      const nom = s.activityNom ?? SANS;
      const e = m.get(nom) ?? { couleur: s.activityCouleur, jours: JOURS.map(() => []) };
      e.jours[s.jour].push(s);
      m.set(nom, e);
    }
    for (const e of m.values()) {
      for (const jour of e.jours) jour.sort((a, b) => minutes(a.heureDebut) - minutes(b.heureDebut));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [deLaSemaine]);

  // Nombre de vétérinaires distincts par jour.
  const parJour = useMemo(
    () =>
      JOURS.map(
        (_, jour) => new Set(deLaSemaine.filter((s) => s.jour === jour).map((s) => s.workerId)).size,
      ),
    [deLaSemaine],
  );

  if (charge && deLaSemaine.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Aucune semaine type enregistrée en S{semaine} pour l&apos;équipe.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Couverture de l&apos;équipe — semaine S{semaine}</h2>
          {enCours && <Badge variant="success">en cours</Badge>}
          <span className="text-xs text-muted-foreground">
            {prochainLundi ? `${enCours ? "" : "prochaine : "}${semaineDu(prochainLundi)} · ` : ""}
            {new Set(deLaSemaine.map((s) => s.workerId)).size} vétérinaires concernés
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-36 border border-border bg-muted px-2 py-1.5 text-left">
                  Activité
                </th>
                {JOURS.map((j, i) => (
                  <th key={j} className="min-w-[150px] border border-border bg-muted px-2 py-1.5">
                    <div className="font-semibold">{j}</div>
                    <div className="text-[11px] font-normal text-muted-foreground">
                      {parJour[i]} véto{parJour[i] > 1 ? "s" : ""}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parActivite.map(([nom, e]) => (
                <tr key={nom}>
                  <th className="sticky left-0 z-10 border border-border bg-card px-2 py-1 text-left font-medium">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/10"
                        style={{ backgroundColor: e.couleur ?? "#e2e8f0" }}
                      />
                      {nom}
                    </span>
                  </th>
                  {e.jours.map((duJour, i) => (
                    <td key={i} className="border border-border align-top p-1">
                      {duJour.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-semibold">{duJour.length}</div>
                          {duJour.map((s) => (
                            <div
                              key={s.id}
                              className="truncate rounded px-1"
                              style={{
                                backgroundColor: s.activityCouleur ?? "#e2e8f0",
                                color: texteSur(s.activityCouleur ?? "#e2e8f0"),
                              }}
                              title={`${s.workerNom} · ${s.heureDebut}–${s.heureFin}`}
                            >
                              {s.workerNom} <span className="tabular-nums">{s.heureDebut}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Le compte d&apos;un jour additionne les vétérinaires présents sur l&apos;activité, quels
          que soient leurs horaires : survolez un nom pour voir sa plage.
        </p>
      </CardContent>
    </Card>
  );
}

// "2026-11-30" -> "30/11 → 06/12"
function semaineDu(lundi: string): string {
  const [y, m, d] = lundi.split("-").map(Number);
  const fin = new Date(Date.UTC(y, m - 1, d) + 6 * 86_400_000).toISOString().slice(0, 10);
  const jj = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return `${jj(lundi)} → ${jj(fin)}`;
}
