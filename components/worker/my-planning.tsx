"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, List, Flag } from "lucide-react";
import { PlanningCalendar } from "@/components/planning-calendar";
import { ComplaintDialog } from "@/components/worker/complaint-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dateLongFr, dateFr } from "@/lib/utils";
import type { SerializedItem } from "@/lib/schedule";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const dow = (new Date(ms).getUTCDay() + 6) % 7;
  return new Date(ms - dow * 86_400_000).toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}

type Filtre = "today" | "week" | "all";

export function MyPlanning() {
  const [items, setItems] = useState<SerializedItem[]>([]);
  const [view, setView] = useState<"liste" | "calendrier">("liste");
  const [filtre, setFiltre] = useState<Filtre>("week");
  const [detail, setDetail] = useState<SerializedItem | null>(null);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [preselect, setPreselect] = useState<string | undefined>();

  const load = useCallback(async () => {
    const res = await fetch("/api/schedule/published?mine=1");
    if (res.ok) {
      const j = await res.json();
      setItems(j.items);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Filtrage + groupement par jour.
  const groupes = useMemo(() => {
    const t = todayStr();
    let filtered = items;
    if (filtre === "today") filtered = items.filter((i) => i.date === t);
    else if (filtre === "week") {
      const lun = mondayOf(t);
      const dim = addDays(lun, 6);
      filtered = items.filter((i) => i.date >= lun && i.date <= dim);
    }
    const sorted = [...filtered].sort(
      (a, b) => a.date.localeCompare(b.date) || a.heureDebut.localeCompare(b.heureDebut),
    );
    const map = new Map<string, SerializedItem[]>();
    for (const it of sorted) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }
    return [...map.entries()];
  }, [items, filtre]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Mon planning</h1>
        <div className="flex overflow-hidden rounded-md border border-border">
          <button
            onClick={() => setView("liste")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${view === "liste" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            <List className="h-4 w-4" /> Liste
          </button>
          <button
            onClick={() => setView("calendrier")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${view === "calendrier" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            <CalendarDays className="h-4 w-4" /> Calendrier
          </button>
        </div>
      </div>

      {view === "liste" ? (
        <>
          {/* Filtres rapides */}
          <div className="flex gap-2">
            {(["today", "week", "all"] as Filtre[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                className={`rounded-full px-3 py-1 text-sm ${filtre === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {f === "today" ? "Aujourd'hui" : f === "week" ? "Cette semaine" : "Tout"}
              </button>
            ))}
          </div>

          {groupes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun créneau {filtre === "today" ? "aujourd'hui" : filtre === "week" ? "cette semaine" : "publié"}.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupes.map(([date, jourItems]) => (
                <div key={date}>
                  <div className="mb-1.5 text-sm font-semibold capitalize text-muted-foreground">
                    {dateLongFr(date)}
                  </div>
                  <div className="space-y-2">
                    {jourItems.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => setDetail(it)}
                        className="flex w-full items-stretch gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-sm active:bg-muted"
                      >
                        <div
                          className="w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: it.activityCouleur || it.roomCouleur || "#94a3b8" }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">
                            {it.heureDebut} – {it.heureFin}
                          </div>
                          <div className="truncate text-sm">{it.activityNom ?? it.titre ?? "Créneau"}</div>
                          {it.roomNom && <div className="text-xs text-muted-foreground">{it.roomNom}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun créneau publié.</p>
            ) : (
              <PlanningCalendar items={items} readOnly onEventClick={(it) => setDetail(it)} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Détail d'un créneau */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title="Détail du créneau">
        {detail && (
          <div className="space-y-2 text-sm">
            <Row label="Date" value={dateFr(detail.date)} />
            <Row label="Heure" value={`${detail.heureDebut} – ${detail.heureFin}`} />
            <Row label="Salle" value={detail.roomNom ?? "—"} />
            <Row label="Activité" value={detail.activityNom ?? detail.titre ?? "—"} />
            {detail.description && <Row label="Note" value={detail.description} />}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPreselect(detail.id);
                  setDetail(null);
                  setComplaintOpen(true);
                }}
              >
                <Flag className="h-4 w-4" /> Signaler un problème
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <ComplaintDialog
        open={complaintOpen}
        onClose={() => setComplaintOpen(false)}
        onSent={() => alert("Réclamation envoyée à la RH.")}
        items={items.map((it) => ({
          id: it.id,
          label: `${dateFr(it.date)} ${it.heureDebut}-${it.heureFin} · ${it.roomNom || it.activityNom || "Créneau"}`,
        }))}
        preselectId={preselect}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
