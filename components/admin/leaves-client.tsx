"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dateFr } from "@/lib/utils";
import type { RefOption } from "@/lib/reference";

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

export function LeavesClient({ workers = [] }: { workers?: RefOption[] }) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [encoderOuvert, setEncoderOuvert] = useState(false);

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

  async function supprimer(l: Leave) {
    if (!confirm(`Supprimer le congé de ${l.workerNom} du ${dateFr(l.dateDebut)} au ${dateFr(l.dateFin)} ? Ses créneaux « Congé » seront retirés du planning.`)) {
      return;
    }
    await fetch(`/api/leaves/${l.id}`, { method: "DELETE" });
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
        <div className="flex items-center gap-2">
          <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="APPROUVE">Approuvé</option>
            <option value="REFUSE">Refusé</option>
          </Select>
          <Button onClick={() => setEncoderOuvert(true)}>
            <Plus className="h-4 w-4" /> Encoder un congé
          </Button>
        </div>
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
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={() => supprimer(l)}>
                        <Trash2 className="h-4 w-4 text-danger" />
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

      {encoderOuvert && (
        <EncoderCongeDialog
          workers={workers}
          onClose={() => setEncoderOuvert(false)}
          onSaved={() => {
            setEncoderOuvert(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// La RH encode le congé de quelqu'un : il est accordé d'emblée, apparaît dans
// l'onglet « Congés » de la personne et pose ses journées dans le planning.
function EncoderCongeDialog({
  workers,
  onClose,
  onSaved,
}: {
  workers: RefOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    workerId: workers[0]?.id ?? "",
    dateDebut: aujourdhui,
    dateFin: aujourdhui,
    motif: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, motif: form.motif || null }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Enregistrement impossible.");
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} title="Encoder un congé">
      <div className="space-y-3 text-sm">
        <div>
          <Label>Personne</Label>
          <Select
            value={form.workerId}
            onChange={(e) => setForm({ ...form, workerId: e.target.value })}
          >
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Du</Label>
            <Input
              type="date"
              value={form.dateDebut}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  dateDebut: e.target.value,
                  dateFin: f.dateFin < e.target.value ? e.target.value : f.dateFin,
                }))
              }
            />
          </div>
          <div>
            <Label>Au</Label>
            <Input
              type="date"
              min={form.dateDebut}
              value={form.dateFin}
              onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Motif (facultatif)</Label>
          <Textarea
            rows={2}
            value={form.motif}
            onChange={(e) => setForm({ ...form, motif: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Le congé est enregistré comme accordé : une journée « Congé » est posée dans le planning
          pour chaque jour de la période, et toute autre activité planifiée ces jours-là
          apparaîtra dans les incohérences.
        </p>
        {error && <p className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={save} disabled={busy || !form.workerId}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
