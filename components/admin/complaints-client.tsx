"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dateFr } from "@/lib/utils";

interface Complaint {
  id: string;
  type: string;
  typeLabel: string;
  commentaire: string | null;
  status: string;
  createdAt: string;
  workerNom: string;
  scheduleItem: {
    id: string;
    titre: string | null;
    date: string;
    heureDebut: string;
    heureFin: string;
    roomNom: string | null;
  } | null;
}

const STATUS_OPTIONS = [
  { value: "NOUVELLE", label: "Nouvelle" },
  { value: "EN_COURS", label: "En cours" },
  { value: "RESOLUE", label: "Résolue" },
  { value: "REFUSEE", label: "Refusée" },
];

const STATUS_VARIANT: Record<string, "warning" | "default" | "success" | "danger"> = {
  NOUVELLE: "warning",
  EN_COURS: "default",
  RESOLUE: "success",
  REFUSEE: "danger",
};

export function ComplaintsClient() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState("ALL");

  async function load() {
    const res = await fetch("/api/complaints");
    if (res.ok) setComplaints(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function changeStatus(id: string, status: string) {
    await fetch(`/api/complaints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const shown = filter === "ALL" ? complaints : complaints.filter((c) => c.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Réclamations</h1>
          <p className="text-sm text-muted-foreground">{complaints.length} réclamation(s)</p>
        </div>
        <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Tous les statuts</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Travailleur</TH>
                <TH>Type</TH>
                <TH>Créneau concerné</TH>
                <TH>Commentaire</TH>
                <TH>Statut</TH>
              </TR>
            </THead>
            <TBody>
              {shown.map((c) => (
                <TR key={c.id}>
                  <TD className="whitespace-nowrap">{dateFr(c.createdAt.slice(0, 10))}</TD>
                  <TD className="font-medium">{c.workerNom}</TD>
                  <TD>{c.typeLabel}</TD>
                  <TD className="text-xs text-muted-foreground">
                    {c.scheduleItem
                      ? `${dateFr(c.scheduleItem.date)} ${c.scheduleItem.heureDebut}-${c.scheduleItem.heureFin}${
                          c.scheduleItem.roomNom ? ` · ${c.scheduleItem.roomNom}` : ""
                        }`
                      : "—"}
                  </TD>
                  <TD className="max-w-[220px] text-xs">{c.commentaire ?? "—"}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[c.status]}>
                        {STATUS_OPTIONS.find((s) => s.value === c.status)?.label}
                      </Badge>
                      <Select
                        className="h-8 w-32"
                        value={c.status}
                        onChange={(e) => changeStatus(c.id, e.target.value)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </TD>
                </TR>
              ))}
              {shown.length === 0 && (
                <TR>
                  <TD className="py-6 text-center text-muted-foreground" colSpan={6}>
                    Aucune réclamation.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
