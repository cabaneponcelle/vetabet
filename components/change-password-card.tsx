"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next !== confirm) {
      setMessage({ ok: false, text: "Les deux nouveaux mots de passe ne correspondent pas." });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage({ ok: true, text: "✅ Mot de passe modifié." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } else {
      setMessage({ ok: false, text: j.error ?? "Erreur lors du changement." });
    }
    setSaving(false);
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-sm">Changer mon mot de passe</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Mot de passe actuel</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div>
            <Label>Nouveau mot de passe</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div>
            <Label>Confirmer le nouveau mot de passe</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {message && (
            <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Modifier le mot de passe"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
