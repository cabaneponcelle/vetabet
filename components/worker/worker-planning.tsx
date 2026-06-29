"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { PlanningCalendar } from "@/components/planning-calendar";
import { ComplaintDialog } from "@/components/worker/complaint-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { dateFr } from "@/lib/utils";
import type { SerializedItem } from "@/lib/schedule";
import type { RefOption } from "@/lib/reference";

function itemLabel(it: SerializedItem): string {
  return `${dateFr(it.date)} ${it.heureDebut}-${it.heureFin} · ${
    it.roomNom || it.activityNom || it.titre || "Créneau"
  }`;
}

export function WorkerPlanning({
  scope,
  reference,
}: {
  scope: "mine" | "global";
  reference?: { workers: RefOption[]; rooms: RefOption[] };
}) {
  const [items, setItems] = useState<SerializedItem[]>([]);
  const [globalAutorise, setGlobalAutorise] = useState(true);
  const [detail, setDetail] = useState<SerializedItem | null>(null);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [preselect, setPreselect] = useState<string | undefined>();
  const [workerId, setWorkerId] = useState("");
  const [roomId, setRoomId] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (scope === "mine") params.set("mine", "1");
    if (scope === "global") {
      if (workerId) params.set("workerId", workerId);
      if (roomId) params.set("roomId", roomId);
    }
    const res = await fetch(`/api/schedule/published?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      setItems(j.items);
      setGlobalAutorise(j.globalAutorise);
    }
  }, [scope, workerId, roomId]);

  useEffect(() => {
    load();
  }, [load]);

  if (scope === "global" && !globalAutorise) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          La consultation du planning global n&apos;est pas autorisée par la RH.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {scope === "mine" ? "Mon planning" : "Planning global publié"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Dernière version publiée par la RH.
          </p>
        </div>
        {scope === "global" && reference && (
          <div className="flex gap-2">
            <Select className="w-44" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">Tous les travailleurs</option>
              {reference.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </Select>
            <Select className="w-44" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Toutes les salles</option>
              {reference.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun créneau publié pour l&apos;instant.
            </p>
          ) : (
            <PlanningCalendar items={items} readOnly onEventClick={(it) => setDetail(it)} />
          )}
        </CardContent>
      </Card>

      {/* Détail d'un créneau */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title="Détail du créneau">
        {detail && (
          <div className="space-y-2 text-sm">
            <Row label="Date" value={dateFr(detail.date)} />
            <Row label="Heure" value={`${detail.heureDebut} – ${detail.heureFin}`} />
            <Row label="Travailleur" value={detail.workerNom ?? "—"} />
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
        items={items.map((it) => ({ id: it.id, label: itemLabel(it) }))}
        preselectId={preselect}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
