"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, HandHelping } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dateLongFr } from "@/lib/utils";
import type { GardeReprenable } from "@/lib/gardes";

export function WorkerGardes() {
  const [gardes, setGardes] = useState<GardeReprenable[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/gardes");
    if (res.ok) setGardes(await res.json());
    else setGardes([]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function take(g: GardeReprenable) {
    if (
      !confirm(
        `Reprendre la garde de ${g.workerNom} le ${dateLongFr(g.date)} de ${g.heureDebut} à ${g.heureFin} ?`,
      )
    )
      return;
    setBusy(g.id);
    setMsg(null);
    const res = await fetch(`/api/gardes/${g.id}/take`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: `✅ ${j.message} Elle apparaît maintenant dans votre planning.` });
    } else {
      setMsg({ ok: false, text: j.error ?? "Impossible de reprendre cette garde." });
    }
    setBusy(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Moon className="h-5 w-5 text-primary" /> Gardes à reprendre
        </h1>
        <p className="text-sm text-muted-foreground">
          Créneaux de collègues partis en congé — cliquez pour les reprendre. Le planning est mis à
          jour immédiatement et la RH est prévenue.
        </p>
      </div>

      {msg && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
        >
          {msg.text}
        </p>
      )}

      {gardes === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : gardes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            🎉 Aucune garde à reprendre pour le moment — tout le monde est à son poste.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gardes.map((g) => (
            <Card key={g.id}>
              <CardContent className="space-y-2">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-10 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: g.activityCouleur || "#94a3b8" }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold capitalize">{dateLongFr(g.date)}</div>
                    <div className="text-sm">
                      {g.heureDebut} – {g.heureFin} · {g.activityNom ?? g.titre ?? "Créneau"}
                    </div>
                    {g.roomNom && <div className="text-xs text-muted-foreground">{g.roomNom}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Au lieu de <span className="font-medium text-foreground">{g.workerNom}</span>{" "}
                      (en congé)
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={() => take(g)} disabled={busy === g.id}>
                  <HandHelping className="h-4 w-4" />
                  {busy === g.id ? "Reprise…" : "Reprendre cette garde"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
