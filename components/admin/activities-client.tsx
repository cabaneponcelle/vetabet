"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { texteSur } from "@/lib/couleurs";

interface Activity {
  id: string;
  nom: string;
  categorie: string | null;
  couleur: string;
  creneaux: number;
}

// Couleurs de la légende Excel de la clinique : un clic suffit pour retomber
// sur une teinte déjà utilisée ailleurs dans le planning.
const PALETTE = [
  "#66FFFF", "#F4B183", "#FF00FF", "#00FF00", "#FF5050", "#CCCCFF",
  "#7030A0", "#3AA87E", "#0070C0", "#F88628", "#FFCCFF", "#0066FF",
  "#8FAADC", "#BFBFBF", "#FA26CD", "#FFA6A6", "#CC99FF", "#87D5B7",
];

export function ActivitiesClient() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/activities");
    if (res.ok) setActivities(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function supprimer(a: Activity) {
    if (a.creneaux > 0) {
      const autres = activities.filter((x) => x.id !== a.id);
      const choix = prompt(
        `« ${a.nom} » est utilisée par ${a.creneaux} créneau(x).\n` +
          `Pour la supprimer, indiquez l'activité qui la remplace :\n\n` +
          autres.map((x) => x.nom).join("\n"),
      );
      if (!choix) return;
      const cible = autres.find((x) => x.nom.toLowerCase() === choix.trim().toLowerCase());
      if (!cible) {
        alert("Activité de remplacement inconnue.");
        return;
      }
      const res = await fetch(`/api/activities/${a.id}?remplacerPar=${cible.id}`, {
        method: "DELETE",
      });
      if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Suppression impossible.");
      load();
      return;
    }
    if (!confirm(`Supprimer l'activité « ${a.nom} » ?`)) return;
    await fetch(`/api/activities/${a.id}`, { method: "DELETE" });
    load();
  }

  const total = activities.reduce((n, a) => n + a.creneaux, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Activités</h1>
          <p className="text-sm text-muted-foreground">
            {activities.length} activité(s) · {total} créneaux · la couleur est celle des blocs du
            planning
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-24">Couleur</TH>
                <TH>Nom</TH>
                <TH>Catégorie</TH>
                <TH>Créneaux</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {activities.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <span
                      className="inline-block h-6 w-14 rounded border border-black/10 align-middle"
                      style={{ backgroundColor: a.couleur }}
                      title={a.couleur}
                    />
                  </TD>
                  <TD className="font-medium">{a.nom}</TD>
                  <TD className="text-muted-foreground">{a.categorie ?? "—"}</TD>
                  <TD>{a.creneaux}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Renommer / changer la couleur"
                        onClick={() => {
                          setEditing(a);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Supprimer" onClick={() => supprimer(a)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
              {activities.length === 0 && (
                <TR>
                  <TD className="py-6 text-center text-muted-foreground" colSpan={5}>
                    Aucune activité.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {dialogOpen && (
        <ActivityDialog
          activity={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ActivityDialog({
  activity,
  onClose,
  onSaved,
}: {
  activity: Activity | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nom: activity?.nom ?? "",
    categorie: activity?.categorie ?? "",
    couleur: activity?.couleur ?? "#3b82f6",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(activity ? `/api/activities/${activity.id}` : "/api/activities", {
      method: activity ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, categorie: form.categorie || null }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Enregistrement impossible.");
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} title={activity ? "Modifier l'activité" : "Nouvelle activité"}>
      <div className="space-y-3 text-sm">
        <div>
          <Label>Nom</Label>
          <Input
            value={form.nom}
            placeholder="Ex. Consultation spécialisée"
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
          />
        </div>
        <div>
          <Label>Catégorie (facultatif)</Label>
          <Select
            value={form.categorie}
            onChange={(e) => setForm({ ...form, categorie: e.target.value })}
          >
            <option value="">— Aucune —</option>
            {["Consultation", "Chirurgie", "Imagerie", "Hospitalisation", "Formation", "Congés", "Autres"].map(
              (c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ),
            )}
          </Select>
        </div>
        <div>
          <Label>Couleur dans le planning</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-14 cursor-pointer rounded border border-border bg-card"
              value={form.couleur}
              onChange={(e) => setForm({ ...form, couleur: e.target.value.toUpperCase() })}
            />
            <Input
              className="w-32 font-mono"
              value={form.couleur}
              onChange={(e) => setForm({ ...form, couleur: e.target.value.toUpperCase() })}
            />
            <span
              className="flex h-9 flex-1 items-center justify-center rounded border border-black/10 text-xs"
              style={{ backgroundColor: form.couleur, color: texteSur(form.couleur) }}
            >
              {form.nom || "Aperçu"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setForm({ ...form, couleur: c })}
                className="h-6 w-6 rounded border border-black/10"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {activity && activity.creneaux > 0 && (
          <p className="text-xs text-muted-foreground">
            {activity.creneaux} créneau(x) utilisent cette activité : ils prendront le nouveau nom
            et la nouvelle couleur.
          </p>
        )}
        {error && <p className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={save} disabled={busy || !form.nom.trim()}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
