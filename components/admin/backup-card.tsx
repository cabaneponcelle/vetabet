"use client";

import { useEffect, useState } from "react";
import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BackupCard() {
  const [keys, setKeys] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    fetch("/api/admin/backups")
      .then((r) => r.json())
      .then((j) => {
        setKeys(j.keys ?? []);
        setUnavailable(!!j.unavailable);
      })
      .catch(() => setUnavailable(true));
  }, []);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Save className="h-4 w-4" /> Sauvegardes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <a href="/api/admin/backup" download>
            <Button>
              <Download className="h-4 w-4" /> Télécharger une sauvegarde maintenant
            </Button>
          </a>
          <p className="mt-1 text-xs text-muted-foreground">
            Fichier JSON complet (sensible : contient les comptes). Conservez-le en lieu sûr.
          </p>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Sauvegardes automatiques (quotidiennes)
          </div>
          {unavailable ? (
            <p className="text-xs text-muted-foreground">
              Disponibles uniquement sur le site déployé (Netlify).
            </p>
          ) : keys.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune sauvegarde automatique pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {keys.map((k) => (
                <li key={k}>
                  <a className="text-primary hover:underline" href={`/api/admin/backups/${encodeURIComponent(k)}`}>
                    {k}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
