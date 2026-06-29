"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, CalendarRange, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface Availability {
  jourSemaine: number;
  heureDebut: string;
  heureFin: string;
}
interface Worker {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  fonction: string | null;
  telephone: string | null;
  actif: boolean;
  availabilities: Availability[];
}

interface DayState {
  enabled: boolean;
  debut: string;
  fin: string;
}

function emptyDays(av: Availability[] = []): DayState[] {
  return Array.from({ length: 7 }, (_, i) => {
    const a = av.find((x) => x.jourSemaine === i);
    return a
      ? { enabled: true, debut: a.heureDebut, fin: a.heureFin }
      : { enabled: false, debut: "08:00", fin: "19:00" };
  });
}

export function WorkersClient() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [edtWorker, setEdtWorker] = useState<Worker | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) setWorkers(await res.json());
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActif(w: Worker) {
    await fetch(`/api/workers/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !w.actif }),
    });
    load();
  }

  async function remove(w: Worker) {
    if (!confirm(`Supprimer définitivement ${w.prenom} ${w.nom} ?`)) return;
    await fetch(`/api/workers/${w.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Travailleurs</h1>
          <p className="text-sm text-muted-foreground">{workers.length} fiche(s)</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Rechercher un travailleur…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Nom</TH>
                <TH>Fonction</TH>
                <TH>Téléphone</TH>
                <TH>Statut</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {workers.map((w) => (
                <TR key={w.id}>
                  <TD className="font-medium">
                    {w.prenom} {w.nom}
                  </TD>
                  <TD>{w.fonction ?? "—"}</TD>
                  <TD>{w.telephone ?? "—"}</TD>
                  <TD>
                    <Badge variant={w.actif ? "success" : "default"}>
                      {w.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Voir l'emploi du temps" onClick={() => setEdtWorker(w)}>
                        <CalendarRange className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Modifier"
                        onClick={() => {
                          setEditing(w);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title={w.actif ? "Désactiver" : "Activer"} onClick={() => toggleActif(w)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={() => remove(w)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
              {workers.length === 0 && (
                <TR>
                  <TD className="py-6 text-center text-muted-foreground" colSpan={5}>
                    Aucun travailleur.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {dialogOpen && (
        <WorkerFormDialog
          worker={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            load();
          }}
        />
      )}

      {edtWorker && <EdtDialog worker={edtWorker} onClose={() => setEdtWorker(null)} />}
    </div>
  );
}

function WorkerFormDialog({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    prenom: worker?.prenom ?? "",
    nom: worker?.nom ?? "",
    fonction: worker?.fonction ?? "Vétérinaire",
    telephone: worker?.telephone ?? "",
    password: "",
    actif: worker?.actif ?? true,
  });
  const [days, setDays] = useState<DayState[]>(emptyDays(worker?.availabilities));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const availabilities = days
      .map((d, i) => (d.enabled ? { jourSemaine: i, heureDebut: d.debut, heureFin: d.fin } : null))
      .filter(Boolean);
    const payload: Record<string, unknown> = { ...form, availabilities };
    if (!payload.password) delete payload.password;

    const url = worker ? `/api/workers/${worker.id}` : "/api/workers";
    const res = await fetch(url, {
      method: worker ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur d'enregistrement");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} title={worker ? "Modifier le travailleur" : "Nouveau travailleur"} className="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prénom</Label>
            <Input value={form.prenom} onChange={(e) => setF("prenom", e.target.value)} />
          </div>
          <div>
            <Label>Nom</Label>
            <Input value={form.nom} onChange={(e) => setF("nom", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fonction</Label>
            <Input value={form.fonction} onChange={(e) => setF("fonction", e.target.value)} />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={form.telephone} onChange={(e) => setF("telephone", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>{worker ? "Réinitialiser le mot de passe (optionnel)" : "Mot de passe"}</Label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setF("password", e.target.value)}
            placeholder={worker ? "Laisser vide pour conserver" : "veto1234 par défaut"}
          />
          {worker && (
            <p className="mt-1 text-xs text-muted-foreground">
              En tant qu&apos;admin, vous pouvez définir un nouveau mot de passe ici.
            </p>
          )}
        </div>

        <div>
          <Label>Disponibilités hebdomadaires</Label>
          <div className="space-y-1.5 rounded-md border border-border p-2">
            {days.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <label className="flex w-28 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) =>
                      setDays((arr) => arr.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))
                    }
                  />
                  {JOURS[i]}
                </label>
                <Input
                  type="time"
                  className="h-8 w-28"
                  value={d.debut}
                  disabled={!d.enabled}
                  onChange={(e) => setDays((arr) => arr.map((x, j) => (j === i ? { ...x, debut: e.target.value } : x)))}
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="time"
                  className="h-8 w-28"
                  value={d.fin}
                  disabled={!d.enabled}
                  onChange={(e) => setDays((arr) => arr.map((x, j) => (j === i ? { ...x, fin: e.target.value } : x)))}
                />
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.actif} onChange={(e) => setF("actif", e.target.checked)} />
          Compte actif
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

interface EdtItem {
  id: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  titre: string | null;
  roomNom: string | null;
  activityNom: string | null;
}

function EdtDialog({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [items, setItems] = useState<EdtItem[] | null>(null);

  useEffect(() => {
    fetch(`/api/schedule-items?status=DRAFT&workerId=${worker.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems);
  }, [worker.id]);

  return (
    <Dialog open onClose={onClose} title={`Emploi du temps — ${worker.prenom} ${worker.nom}`}>
      {!items ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun créneau (brouillon) pour ce travailleur.</p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto text-sm">
          {items.map((it) => (
            <div key={it.id} className="rounded-md border border-border p-2">
              <div className="font-medium">
                {it.date} · {it.heureDebut}-{it.heureFin}
              </div>
              <div className="text-muted-foreground">
                {[it.titre || it.activityNom, it.roomNom].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
