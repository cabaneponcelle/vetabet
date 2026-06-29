import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Conflict } from "@/lib/conflicts";

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

export function ConflictPanel({ conflicts, compact }: { conflicts: Conflict[]; compact?: boolean }) {
  const bloquants = conflicts.filter((c) => c.severite === "BLOQUANT");
  const avert = conflicts.filter((c) => c.severite === "AVERTISSEMENT");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Incohérences détectées
        </CardTitle>
        <div className="flex gap-1">
          <Badge variant="danger">{bloquants.length} bloquant(s)</Badge>
          <Badge variant="warning">{avert.length} avert.</Badge>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-2", compact ? "max-h-72 overflow-y-auto" : "max-h-[60vh] overflow-y-auto")}>
        {conflicts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Aucune incohérence. Le planning est prêt à être publié.
          </div>
        ) : (
          [...bloquants, ...avert].map((c, i) => (
            <div
              key={i}
              className={cn(
                "rounded-md border p-2 text-xs",
                c.severite === "BLOQUANT"
                  ? "border-danger/30 bg-danger/5"
                  : "border-warning/30 bg-warning/5",
              )}
            >
              <div className="mb-0.5 flex items-center gap-1.5 font-medium">
                {c.severite === "BLOQUANT" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-danger" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                )}
                {TYPE_LABEL[c.type] ?? c.type}
              </div>
              <p className="text-muted-foreground">{c.message}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
