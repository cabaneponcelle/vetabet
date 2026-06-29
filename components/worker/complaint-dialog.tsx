"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TYPES = [
  { value: "INDISPO", label: "Je ne suis pas disponible" },
  { value: "MAUVAISE_SALLE", label: "Mauvaise salle" },
  { value: "HORAIRE", label: "Horaire incorrect" },
  { value: "CONFLIT", label: "Conflit avec un autre créneau" },
  { value: "AUTRE", label: "Autre problème" },
];

export interface PickItem {
  id: string;
  label: string;
}

export function ComplaintDialog({
  open,
  onClose,
  onSent,
  items,
  preselectId,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  items: PickItem[];
  preselectId?: string;
}) {
  const [scheduleItemId, setScheduleItemId] = useState("");
  const [type, setType] = useState("INDISPO");
  const [commentaire, setCommentaire] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setScheduleItemId(preselectId ?? "");
      setType("INDISPO");
      setCommentaire("");
      setError(null);
    }
  }, [open, preselectId]);

  async function send() {
    setSending(true);
    setError(null);
    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleItemId: scheduleItemId || null, type, commentaire }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Erreur lors de l'envoi.");
      setSending(false);
      return;
    }
    onSent();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Signaler un problème">
      <div className="space-y-3">
        <div>
          <Label>Créneau concerné</Label>
          <Select value={scheduleItemId} onChange={(e) => setScheduleItemId(e.target.value)}>
            <option value="">— Aucun créneau précis —</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Type de problème</Label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Commentaire</Label>
          <Textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Décrivez le problème…"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={send} disabled={sending}>
            {sending ? "Envoi…" : "Envoyer la réclamation"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
