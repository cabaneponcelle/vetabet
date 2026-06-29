"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

interface Room {
  id: string;
  nom: string;
  type: string | null;
  description: string | null;
  couleur: string;
  actif: boolean;
}

export function RoomsClient() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Room | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/rooms${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) setRooms(await res.json());
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(r: Room) {
    await fetch(`/api/rooms/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !r.actif }),
    });
    load();
  }
  async function remove(r: Room) {
    if (!confirm(`Supprimer la salle « ${r.nom} » ?`)) return;
    await fetch(`/api/rooms/${r.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Salles</h1>
          <p className="text-sm text-muted-foreground">{rooms.length} salle(s)</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Rechercher une salle…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Salle</TH>
                <TH>Type</TH>
                <TH>Couleur</TH>
                <TH>Statut</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rooms.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.nom}</TD>
                  <TD>{r.type ?? "—"}</TD>
                  <TD>
                    <span className="inline-block h-4 w-8 rounded" style={{ backgroundColor: r.couleur }} />
                  </TD>
                  <TD>
                    <Badge variant={r.actif ? "success" : "default"}>{r.actif ? "Active" : "Inactive"}</Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title={r.actif ? "Désactiver" : "Activer"} onClick={() => toggle(r)}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={() => remove(r)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
              {rooms.length === 0 && (
                <TR>
                  <TD className="py-6 text-center text-muted-foreground" colSpan={5}>
                    Aucune salle.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {open && (
        <RoomFormDialog
          room={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RoomFormDialog({ room, onClose, onSaved }: { room: Room | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nom: room?.nom ?? "",
    type: room?.type ?? "",
    description: room?.description ?? "",
    couleur: room?.couleur ?? "#3b82f6",
    actif: room?.actif ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(room ? `/api/rooms/${room.id}` : "/api/rooms", {
      method: room ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
    <Dialog open onClose={onClose} title={room ? "Modifier la salle" : "Nouvelle salle"}>
      <div className="space-y-3">
        <div>
          <Label>Nom</Label>
          <Input value={form.nom} onChange={(e) => setF("nom", e.target.value)} placeholder="Salle d'opération 1" />
        </div>
        <div>
          <Label>Type</Label>
          <Input value={form.type} onChange={(e) => setF("type", e.target.value)} placeholder="Chirurgie, Consultation…" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setF("description", e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <Label>Couleur</Label>
            <input
              type="color"
              value={form.couleur}
              onChange={(e) => setF("couleur", e.target.value)}
              className="h-9 w-16 rounded border border-input"
            />
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.actif} onChange={(e) => setF("actif", e.target.checked)} />
            Salle active
          </label>
        </div>
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
