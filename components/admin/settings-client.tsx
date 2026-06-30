"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordCard } from "@/components/change-password-card";
import { BackupCard } from "@/components/admin/backup-card";
import { dateFr } from "@/lib/utils";

export function SettingsClient() {
  const [emailRh, setEmailRh] = useState("");
  const [voientGlobal, setVoientGlobal] = useState(true);
  const [dernierePub, setDernierePub] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: Record<string, string>) => {
        setEmailRh(s.email_rh ?? "");
        setVoientGlobal((s.workers_voient_planning_global ?? "true") === "true");
        setDernierePub(s.derniere_publication ?? null);
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email_rh: emailRh,
        workers_voient_planning_global: String(voientGlobal),
      }),
    });
    setMessage(res.ok ? "✅ Paramètres enregistrés." : "Erreur lors de l'enregistrement.");
    setSaving(false);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Configuration de l&apos;application.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Réclamations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Email de la RH (destinataire des réclamations)</Label>
            <Input type="email" value={emailRh} onChange={(e) => setEmailRh(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              En développement, les emails sont simulés dans la console serveur (SMTP non configuré).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Droits des travailleurs</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={voientGlobal}
              onChange={(e) => setVoientGlobal(e.target.checked)}
            />
            Autoriser les travailleurs à consulter le planning global publié
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Publication</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dernière publication :{" "}
            <span className="font-medium text-foreground">
              {dernierePub ? `${dateFr(dernierePub.slice(0, 10))} à ${dernierePub.slice(11, 16)}` : "jamais"}
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {message && <span className="text-sm">{message}</span>}
      </div>

      <ChangePasswordCard />
      <BackupCard />
    </div>
  );
}
