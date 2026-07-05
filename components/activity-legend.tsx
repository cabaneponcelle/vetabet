"use client";

import { useState } from "react";
import { Palette, ChevronDown, ChevronUp } from "lucide-react";

interface LegendItem {
  id: string;
  label: string;
  couleur?: string;
}

// Légende repliable des couleurs d'activité (fond des créneaux).
export function ActivityLegend({ activities }: { activities: LegendItem[] }) {
  const [open, setOpen] = useState(false);
  if (activities.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Palette className="h-4 w-4" />
        Légende des couleurs
        {open ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
      </button>
      {open && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-3 py-2">
          {activities.map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-black/10"
                style={{ backgroundColor: a.couleur || "#e2e8f0" }}
              />
              {a.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
