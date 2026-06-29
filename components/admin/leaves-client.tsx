"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dateFr } from "@/lib/utils";

interface Leave {
  id: string;
  workerNom: string;
  dateDebut: string;
  dateFin: string;
  motif: string | null;
  status: string;
  createdAt: string;
}

const STATUS: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  EN_ATTENTE: { label: "En attente", variant: "warning" },
  APPROUVE: { label: "Approuvé", variant: "success" },
  REFUSE: { label: "Refusé", variant: "danger" },
};

export function LeavesClient() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async () => {
    const res = await fetch("/api/leaves");
    if (res.ok) setLeaves(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, status: "APPROUVE" | "REFUSE") {
    await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const shown = filter === "ALL" ? leaves : leaves.filter((l) => l.status === filter);
  const enAttente = leaves.filter((l) => l.status === "EN_ATTENTE").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Congés</h1>
          <p className="text-sm text-muted-foreground">
            {leaves.length} demande(s) · {enAttente} en attente
          </p>
        </div>
        <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Tous les statuts</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="APPROUVE">Approuvé</option>
          <option value="REFUSE">Refusé</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Travailleur</TH>
                <TH>Du</TH>
                <TH>Au</TH>
                <TH>Motif</TH>
                <TH>Statut</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {shown.map((l) => (
                <TR key={l.id}>
                  <TD className="font-medium">{l.workerNom}</TD>
                  <TD className="whitespace-nowrap">{dateFr(l.dateDebut)}</TD>
                  <TD className="whitespace-nowrap">{dateFr(l.dateFin)}</TD>
                  <TD className="max-w-[220px] text-xs text-muted-foreground">{l.motif ?? "—"}</TD>
                  <TD>
                    <Badge variant={STATUS[l.status].variant}>{STATUS[l.status].label}</Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => decide(l.id, "APPROUVE")}
                        disabled={l.status === "APPROUVE"}
                      >
                        <Check className="h-4 w-4" /> Approuver
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => decide(l.id, "REFUSE")}
                        disabled={l.status === "REFUSE"}
                      >
                        <X className="h-4 w-4" /> Refuser
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
              {shown.length === 0 && (
                <TR>
                  <TD className="py-6 text-center text-muted-foreground" colSpan={6}>
                    Aucune demande de congé.
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
