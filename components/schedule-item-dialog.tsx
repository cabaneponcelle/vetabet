"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import type { ReferenceData } from "@/lib/reference";
import type { SerializedItem } from "@/lib/schedule";

export interface DialogDefaults {
  date?: string;
  heureDebut?: string;
  heureFin?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  reference: ReferenceData;
  item?: SerializedItem | null; // édition si fourni
  defaults?: DialogDefaults; // valeurs pré-remplies à la création
}

export function ScheduleItemDialog({ open, onClose, onSaved, reference, item, defaults }: Props) {
  const [form, setForm] = useState({
    titre: "",
    description: "",
    date: "",
    heureDebut: "09:00",
    heureFin: "10:00",
    workerId: "",
    roomId: "",
    activityId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (Ré)initialise le formulaire à l'ouverture.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (item) {
      setForm({
        titre: item.titre ?? "",
        description: item.description ?? "",
        date: item.date,
        heureDebut: item.heureDebut,
        heureFin: item.heureFin,
        workerId: item.workerId ?? "",
        roomId: item.roomId ?? "",
        activityId: item.activityId ?? "",
      });
    } else {
      setForm({
        titre: "",
        description: "",
        date: defaults?.date ?? new Date().toISOString().slice(0, 10),
        heureDebut: defaults?.heureDebut ?? "09:00",
        heureFin: defaults?.heureFin ?? "10:00",
        workerId: "",
        roomId: "",
        activityId: "",
      });
    }
  }, [open, item, defaults]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = item ? `/api/schedule-items/${item.id}` : "/api/schedule-items";
      const method = item ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Erreur lors de l'enregistrement");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    if (!confirm("Supprimer définitivement ce créneau ?")) return;
    setSaving(true);
    try {
      await fetch(`/api/schedule-items/${item.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={item ? "Modifier le créneau" : "Nouveau créneau"}>
      <div className="space-y-3">
        <div>
          <Label>Titre / activité (texte libre)</Label>
          <Input value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Ex. Consultations du matin" />
        </div>

        <div>
          <Label>Type d&apos;activité</Label>
          <Select value={form.activityId} onChange={(e) => set("activityId", e.target.value)}>
            <option value="">— Aucune —</option>
            {reference.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Travailleur</Label>
            <Select value={form.workerId} onChange={(e) => set("workerId", e.target.value)}>
              <option value="">— Aucun —</option>
              {reference.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                  {w.actif === false ? " (inactif)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Salle</Label>
            <Select value={form.roomId} onChange={(e) => set("roomId", e.target.value)}>
              <option value="">— Aucune —</option>
              {reference.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                  {r.actif === false ? " (inactive)" : ""}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <Label>Début</Label>
            <Input type="time" value={form.heureDebut} onChange={(e) => set("heureDebut", e.target.value)} />
          </div>
          <div>
            <Label>Fin</Label>
            <Input type="time" value={form.heureFin} onChange={(e) => set("heureFin", e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Note / description</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {item ? (
            <Button variant="danger" size="sm" onClick={remove} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
