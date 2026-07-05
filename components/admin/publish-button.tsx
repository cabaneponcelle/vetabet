"use client";

import { useState } from "react";
import { UploadCloud, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasBlocking, type Conflict } from "@/lib/conflicts";

function pubFr(iso: string): string {
  const [date, time] = iso.split("T");
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} à ${time?.slice(0, 5) ?? ""}`;
}

export function PublishButton({
  conflicts,
  onPublished,
  lastPublication,
  hasUnpublished,
}: {
  conflicts: Conflict[];
  onPublished?: () => void;
  lastPublication?: string | null;
  hasUnpublished?: boolean;
}) {
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const bloque = hasBlocking(conflicts);
  const nbBloquants = conflicts.filter((c) => c.severite === "BLOQUANT").length;

  async function publish() {
    if (bloque) return;
    setPublishing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/schedule/publish", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur de publication");
      setMessage(`✅ Planning publié (${j.published} créneau·x visibles par les travailleurs).`);
      onPublished?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur de publication");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UploadCloud className="h-4 w-4 text-primary" />
          Publication du planning
        </div>
        {bloque ? (
          <p className="flex items-start gap-1.5 text-xs text-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Corrigez les {nbBloquants} conflit(s) bloquant(s) avant de publier.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Le planning est cohérent : vous pouvez le rendre visible aux travailleurs.
          </p>
        )}
        {hasUnpublished && !bloque && (
          <p className="rounded-md bg-warning/10 px-2 py-1.5 text-xs font-medium text-warning">
            ⚠ Des modifications ne sont pas encore publiées — les travailleurs voient
            l&apos;ancienne version.
          </p>
        )}
        <Button onClick={publish} disabled={bloque || publishing} className="w-full">
          {publishing ? "Publication…" : "Publier le planning"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Dernière publication :{" "}
          {lastPublication ? pubFr(lastPublication) : "jamais"}
        </p>
        {message && <p className="text-xs">{message}</p>}
      </CardContent>
    </Card>
  );
}
