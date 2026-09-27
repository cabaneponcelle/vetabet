"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDaysStr, cn, mondayOf } from "@/lib/utils";

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];

interface Props {
  selected: string[]; // lundis sélectionnés ("AAAA-MM-JJ")
  onToggle: (monday: string) => void;
  sourceMonday: string; // semaine source : affichée mais non sélectionnable
}

/**
 * Mini-calendrier de sélection de semaines : on clique sur une ligne pour
 * choisir la semaine entière. Plusieurs semaines peuvent être sélectionnées.
 */
export function WeekPicker({ selected, onToggle, sourceMonday }: Props) {
  const [cursor, setCursor] = useState(() => sourceMonday.slice(0, 7)); // "AAAA-MM"
  const [annee, mois] = cursor.split("-").map(Number);

  const weeks = useMemo(() => {
    const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
    const fin = mondayOf(`${cursor}-${String(dernierJour).padStart(2, "0")}`);
    const out: string[] = [];
    for (let w = mondayOf(`${cursor}-01`); w <= fin; w = addDaysStr(w, 7)) out.push(w);
    return out;
  }, [cursor, annee, mois]);

  function decalerMois(delta: number) {
    setCursor(new Date(Date.UTC(annee, mois - 1 + delta, 1)).toISOString().slice(0, 7));
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <Button variant="ghost" size="icon" type="button" onClick={() => decalerMois(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">
          {MOIS[mois - 1]} {annee}
        </span>
        <Button variant="ghost" size="icon" type="button" onClick={() => decalerMois(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 px-3 pt-2 text-center text-[10px] text-muted-foreground">
        {JOURS_COURTS.map((j, i) => (
          <span key={i}>{j}</span>
        ))}
      </div>

      <div className="space-y-1 p-2">
        {weeks.map((w) => {
          const isSource = w === sourceMonday;
          const isSelected = selected.includes(w);
          return (
            <button
              key={w}
              type="button"
              disabled={isSource}
              onClick={() => onToggle(w)}
              title={isSource ? "Semaine source" : `Semaine du ${w.slice(8)}/${w.slice(5, 7)}`}
              className={cn(
                "grid w-full grid-cols-7 gap-0.5 rounded-md border px-1 py-1 text-xs transition-colors",
                isSource
                  ? "cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground"
                  : isSelected
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-transparent hover:bg-muted",
              )}
            >
              {Array.from({ length: 7 }, (_, i) => addDaysStr(w, i)).map((d) => (
                <span key={d} className={cn("py-0.5", d.slice(0, 7) !== cursor && "opacity-40")}>
                  {Number(d.slice(8, 10))}
                </span>
              ))}
            </button>
          );
        })}
      </div>

      <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        Cliquez sur une ligne pour choisir la semaine entière. La semaine source est grisée.
      </p>
    </div>
  );
}
