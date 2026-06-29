"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { dateFr } from "@/lib/utils";

interface Leave {
  id: string;
  dateDebut: string;
  dateFin: string;
  motif: string | null;
  status: string;
}

const STATUS: Record<string, { label: string; variant: "warning" | "success" | "danger" }> = {
  EN_ATTENTE: { label: "En attente", variant: "warning" },
  APPROUVE: { label: "Approuvé", variant: "success" },
  REFUSE: { label: "Refusé", variant: "danger" },
};

export function WorkerLeaves() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [motif, setMotif] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/leaves");
    if (res.ok) setLeaves(await res.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateDebut, dateFin, motif }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: "✅ Demande envoyée — en attente de validation." });
      setDateDebut("");
      setDateFin("");
      setMotif("");
      load();
    } else {
      setMsg({ ok: false, text: j.error ?? "Erreur lors de l'envoi." });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Mes congés</h1>
        <p className="text-sm text-muted-foreground">Demandez un congé et suivez vos demandes.</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-sm">Nouvelle demande de congé</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Du</Label>
                <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />
              </div>
              <div>
                <Label>Au</Label>
                <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Motif (optionnel)</Label>
              <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Vacances, raison personnelle…" />
            </div>
            {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Du</TH>
                <TH>Au</TH>
                <TH>Motif</TH>
                <TH>Statut</TH>
              </TR>
            </THead>
            <TBody>
              {leaves.map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap">{dateFr(l.dateDebut)}</TD>
                  <TD className="whitespace-nowrap">{dateFr(l.dateFin)}</TD>
                  <TD className="max-w-[240px] text-xs">{l.motif ?? "—"}</TD>
                  <TD>
                    <Badge variant={STATUS[l.status].variant}>{STATUS[l.status].label}</Badge>
                  </TD>
                </TR>
              ))}
              {leaves.length === 0 && (
                <TR>
                  <TD className="py-6 text-center text-muted-foreground" colSpan={4}>
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
