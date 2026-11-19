"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { texteSur } from "@/lib/couleurs";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SEMAINES = [1, 2, 3, 4];

interface Slot {
  id: string;
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
function heuresDe(slots: Slot[]): string {
  const total = slots.reduce((n, s) => n + minutes(s.heureFin) - minutes(s.heureDebut), 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/**
 * Ce que le vétérinaire voit de son roulement : ses quatre semaines types,
 * en lecture seule, avec le rang de la semaine en cours. C'est le modèle ;
 * le planning réel, lui, est dans « Mon planning ».
 */
export function WorkerTemplates() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [semaineCourante, setSemaineCourante] = useState<number | null>(null);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    fetch("/api/semaines-types")
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((j) => {
        setSlots(j.slots ?? []);
        setSemaineCourante(j.semaineCourante ?? null);
      })
      .finally(() => setCharge(true));
  }, []);

  if (charge && slots.length === 0) {
    return (
      <div className="space-y-4">
        <Entete semaineCourante={semaineCourante} />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucune semaine type n&apos;a encore été enregistrée pour vous par la RH.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Entete semaineCourante={semaineCourante} />
      <div className="grid gap-3 xl:grid-cols-2">
        {SEMAINES.map((semaine) => {
          const liste = slots.filter((s) => s.semaine === semaine);
          return (
            <Card key={semaine}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Semaine S{semaine}</h2>
                    {semaineCourante === semaine && <Badge variant="success">en cours</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{heuresDe(liste)}</span>
                </div>
                <div className="divide-y divide-border rounded-md border border-border">
                  {JOURS.map((nom, jour) => {
                    const duJour = liste
                      .filter((s) => s.jour === jour)
                      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
                    return (
                      <div key={jour} className="flex items-start gap-2 px-2 py-1.5">
                        <span className="w-20 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                          {nom}
                        </span>
                        <div className="flex flex-1 flex-wrap gap-1">
                          {duJour.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            duJour.map((s) => (
                              <span
                                key={s.id}
                                className="rounded px-1.5 py-0.5 text-xs ring-1 ring-black/5"
                                style={{
                                  backgroundColor: s.activityCouleur ?? "#e2e8f0",
                                  color: texteSur(s.activityCouleur ?? "#e2e8f0"),
                                }}
                              >
                                <span className="font-semibold tabular-nums">
                                  {s.heureDebut}–{s.heureFin}
                                </span>{" "}
                                {s.activityNom ?? ""}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Entete({ semaineCourante }: { semaineCourante: number | null }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">Mes semaines types</h1>
      <p className="text-sm text-muted-foreground">
        Votre roulement sur quatre semaines, tel que la RH l&apos;a enregistré
        {semaineCourante ? ` — nous sommes en semaine S${semaineCourante}` : ""}. Le planning
        réellement publié, avec ses ajustements, reste dans « Mon planning ».
      </p>
    </div>
  );
}
