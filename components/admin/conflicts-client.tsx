"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { conflictKey, type Conflict } from "@/lib/conflicts";
import { dateFr } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  HORAIRE_INVALIDE: "Horaire invalide",
  INCOMPLET: "Créneau incomplet",
  SALLE_DESACTIVEE: "Salle désactivée",
  TRAVAILLEUR_DESACTIVE: "Travailleur désactivé",
  HORS_DISPO: "Hors disponibilité",
  SALLE_OCCUPEE: "Salle déjà occupée",
  TRAVAILLEUR_DOUBLE: "Travailleur en double",
  SUR_CONGE: "Planifié pendant un congé",
};

export function ConflictsClient() {
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/conflicts");
    setConflicts(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleIgnore(c: Conflict, ignored: boolean) {
    const key = conflictKey(c);
    setBusyKey(key);
    setError(null);
    const res = await fetch("/api/conflicts/ignore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ignored }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Impossible de modifier cet avertissement.");
    }
    setBusyKey(null);
    load();
  }

  const all = conflicts ?? [];
  const bloquants = all.filter((c) => c.severite === "BLOQUANT");
  const avert = all.filter((c) => c.severite === "AVERTISSEMENT" && !c.ignored);
  const ignores = all.filter((c) => c.ignored);
  const shown = [...bloquants, ...avert, ...(showIgnored ? ignores : [])];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Incohérences du planning</h1>
          <p className="text-sm text-muted-foreground">
            Détection automatique sur le brouillon (salles, travailleurs, horaires, disponibilités).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="danger">{bloquants.length} bloquant(s)</Badge>
          <Badge variant="warning">{avert.length} avertissement(s)</Badge>
          {ignores.length > 0 && (
            <>
              <Badge>{ignores.length} ignoré(s)</Badge>
              <Button variant="outline" size="sm" onClick={() => setShowIgnored((v) => !v)}>
                {showIgnored ? (
                  <>
                    <EyeOff className="h-4 w-4" /> Masquer les ignorés
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" /> Afficher les ignorés
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <Card>
        <CardContent className="p-0">
          {conflicts === null ? (
            <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
          ) : shown.length === 0 ? (
            <div className="flex items-center gap-2 p-6 text-success">
              <CheckCircle2 className="h-5 w-5" />
              {ignores.length > 0
                ? "Aucune incohérence active — seuls des avertissements ignorés subsistent."
                : "Aucune incohérence détectée — le planning est cohérent."}
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Gravité</TH>
                  <TH>Type</TH>
                  <TH>Date</TH>
                  <TH>Heure</TH>
                  <TH>Travailleur</TH>
                  <TH>Salle</TH>
                  <TH>Explication</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {shown.map((c) => {
                  const key = conflictKey(c);
                  return (
                    <TR key={key} className={c.ignored ? "opacity-60" : undefined}>
                      <TD>
                        <Badge variant={c.severite === "BLOQUANT" ? "danger" : "warning"}>
                          {c.severite === "BLOQUANT" ? "Bloquant" : "Avert."}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap font-medium">
                        {TYPE_LABEL[c.type] ?? c.type}
                        {c.ignored && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            (ignoré)
                          </span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">{dateFr(c.date)}</TD>
                      <TD className="whitespace-nowrap">{c.heure}</TD>
                      <TD>{c.travailleur ?? "—"}</TD>
                      <TD>{c.salle ?? "—"}</TD>
                      <TD className="text-muted-foreground">{c.message}</TD>
                      <TD className="text-right">
                        {c.severite === "BLOQUANT" ? (
                          <span
                            className="text-xs text-muted-foreground"
                            title="Un conflit bloquant doit être corrigé : il empêche la publication."
                          >
                            à corriger
                          </span>
                        ) : c.ignored ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyKey === key}
                            onClick={() => toggleIgnore(c, false)}
                          >
                            <Eye className="h-4 w-4" /> Réafficher
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Masquer cet avertissement"
                            disabled={busyKey === key}
                            onClick={() => toggleIgnore(c, true)}
                          >
                            <EyeOff className="h-4 w-4" /> Ignorer
                          </Button>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Ignorer un avertissement le masque partout (tableau de bord, planning) sans modifier le
        planning. Si le créneau concerné change de date ou d&apos;horaire, l&apos;avertissement
        réapparaît. Les conflits bloquants ne peuvent pas être ignorés : ils empêchent la
        publication tant qu&apos;ils ne sont pas corrigés.
      </p>
    </div>
  );
}
