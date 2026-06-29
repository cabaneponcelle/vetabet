import { loadConflicts } from "@/lib/schedule";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CheckCircle2 } from "lucide-react";
import { dateFr } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

export default async function IncoherencesPage() {
  const conflicts = await loadConflicts("DRAFT");
  const bloquants = conflicts.filter((c) => c.severite === "BLOQUANT");
  const avert = conflicts.filter((c) => c.severite === "AVERTISSEMENT");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Incohérences du planning</h1>
          <p className="text-sm text-muted-foreground">
            Détection automatique sur le brouillon (salles, travailleurs, horaires, disponibilités).
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="danger">{bloquants.length} bloquant(s)</Badge>
          <Badge variant="warning">{avert.length} avertissement(s)</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {conflicts.length === 0 ? (
            <div className="flex items-center gap-2 p-6 text-success">
              <CheckCircle2 className="h-5 w-5" />
              Aucune incohérence détectée — le planning est cohérent.
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
                </TR>
              </THead>
              <TBody>
                {[...bloquants, ...avert].map((c, i) => (
                  <TR key={i}>
                    <TD>
                      <Badge variant={c.severite === "BLOQUANT" ? "danger" : "warning"}>
                        {c.severite === "BLOQUANT" ? "Bloquant" : "Avert."}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap font-medium">{TYPE_LABEL[c.type] ?? c.type}</TD>
                    <TD className="whitespace-nowrap">{dateFr(c.date)}</TD>
                    <TD className="whitespace-nowrap">{c.heure}</TD>
                    <TD>{c.travailleur ?? "—"}</TD>
                    <TD>{c.salle ?? "—"}</TD>
                    <TD className="text-muted-foreground">{c.message}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
