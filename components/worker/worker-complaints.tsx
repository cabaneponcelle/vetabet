"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ComplaintDialog, type PickItem } from "@/components/worker/complaint-dialog";
import { dateFr } from "@/lib/utils";
import type { SerializedItem } from "@/lib/schedule";

interface Complaint {
  id: string;
  typeLabel: string;
  commentaire: string | null;
  status: string;
  createdAt: string;
  scheduleItem: { date: string; heureDebut: string; heureFin: string; roomNom: string | null } | null;
}

const STATUS: Record<string, { label: string; variant: "warning" | "default" | "success" | "danger" }> = {
  NOUVELLE: { label: "Nouvelle", variant: "warning" },
  EN_COURS: { label: "En cours", variant: "default" },
  RESOLUE: { label: "Résolue", variant: "success" },
  REFUSEE: { label: "Refusée", variant: "danger" },
};

export function WorkerComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [items, setItems] = useState<PickItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [cRes, iRes] = await Promise.all([
      fetch("/api/complaints"),
      fetch("/api/schedule/published?mine=1"),
    ]);
    if (cRes.ok) setComplaints(await cRes.json());
    if (iRes.ok) {
      const j = await iRes.json();
      setItems(
        (j.items as SerializedItem[]).map((it) => ({
          id: it.id,
          label: `${dateFr(it.date)} ${it.heureDebut}-${it.heureFin} · ${
            it.roomNom || it.activityNom || it.titre || "Créneau"
          }`,
        })),
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Mes réclamations</h1>
          <p className="text-sm text-muted-foreground">{complaints.length} réclamation(s)</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nouvelle réclamation
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Type</TH>
                <TH>Créneau</TH>
                <TH>Commentaire</TH>
                <TH>Statut</TH>
              </TR>
            </THead>
            <TBody>
              {complaints.map((c) => (
                <TR key={c.id}>
                  <TD className="whitespace-nowrap">{dateFr(c.createdAt.slice(0, 10))}</TD>
                  <TD>{c.typeLabel}</TD>
                  <TD className="text-xs text-muted-foreground">
                    {c.scheduleItem
                      ? `${dateFr(c.scheduleItem.date)} ${c.scheduleItem.heureDebut}-${c.scheduleItem.heureFin}`
                      : "—"}
                  </TD>
                  <TD className="max-w-[240px] text-xs">{c.commentaire ?? "—"}</TD>
                  <TD>
                    <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>
                  </TD>
                </TR>
              ))}
              {complaints.length === 0 && (
                <TR>
                  <TD className="py-6 text-center text-muted-foreground" colSpan={5}>
                    Aucune réclamation envoyée.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <ComplaintDialog
        open={open}
        onClose={() => setOpen(false)}
        onSent={load}
        items={items}
      />
    </div>
  );
}
