"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CalendarCheck, Copy } from "lucide-react";
import { WeekPicker } from "@/components/admin/week-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { texteSur } from "@/lib/couleurs";
import { mondayOf } from "@/lib/utils";
import type { ReferenceData } from "@/lib/reference";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SEMAINES = [1, 2, 3, 4];

interface Slot {
  id: string;
  workerId: string;
  workerNom: string | null;
  semaine: number;
  jour: number;
  heureDebut: string;
  heureFin: string;
  activityId: string | null;
  activityNom: string | null;
  activityCouleur: string | null;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function heuresDe(slots: Slot[]): string {
  const total = slots.reduce((n, s) => n + minutes(s.heureFin) - minutes(s.heureDebut), 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/**
 * Semaines types : le roulement de chaque vétérinaire sur quatre semaines
 * (S1 à S4). C'est le modèle de référence — y toucher ne change rien au
 * planning déjà publié tant qu'on ne l'applique pas à des semaines précises.
 */
export function WeekTemplatesClient({
  reference,
  initialWorkerId,
}: {
  reference: ReferenceData;
  initialWorkerId?: string;
}) {
  const [workerId, setWorkerId] = useState(initialWorkerId ?? reference.workers[0]?.id ?? "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [semaineCourante, setSemaineCourante] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ slot: Slot | null; semaine: number; jour: number } | null>(
    null,
  );
  const [appliquerOuvert, setAppliquerOuvert] = useState(false);
  const [copieOuverte, setCopieOuverte] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!workerId) return;
    const res = await fetch(`/api/semaines-types?workerId=${workerId}`);
    if (!res.ok) return;
    const j = await res.json();
    setSlots(j.slots);
    setSemaineCourante(j.semaineCourante);
  }, [workerId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const parSemaine = useMemo(() => {
    const m = new Map<number, Slot[]>();
    for (const s of slots) {
      const l = m.get(s.semaine) ?? [];
      l.push(s);
      m.set(s.semaine, l);
    }
    return m;
  }, [slots]);

  async function supprimer(slot: Slot) {
    await fetch(`/api/semaines-types/${slot.id}`, { method: "DELETE" });
    charger();
  }

  const nomVeto = reference.workers.find((w) => w.id === workerId)?.label ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Semaines types</h1>
          <p className="text-sm text-muted-foreground">
            Le roulement de chaque vétérinaire sur quatre semaines. Modifier une semaine type ne
            change rien au planning publié : il faut l&apos;appliquer à des semaines précises.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-52" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {reference.workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => setCopieOuverte(true)} disabled={!workerId}>
            <Copy className="h-4 w-4" /> Copier une semaine
          </Button>
          <Button onClick={() => setAppliquerOuvert(true)} disabled={!workerId}>
            <CalendarCheck className="h-4 w-4" /> Appliquer au planning
          </Button>
        </div>
      </div>

      {msg && <p className="rounded-md border border-border bg-card px-3 py-2 text-sm">{msg}</p>}

      <div className="grid gap-3 xl:grid-cols-2">
        {SEMAINES.map((semaine) => {
          const liste = parSemaine.get(semaine) ?? [];
          return (
            <Card key={semaine}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Semaine S{semaine}</h2>
                    {semaineCourante === semaine && <Badge variant="success">en cours</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {liste.length} créneau{liste.length > 1 ? "x" : ""} · {heuresDe(liste)}
                  </span>
                </div>

                <div className="divide-y divide-border rounded-md border border-border">
                  {JOURS.map((nom, jour) => {
                    const duJour = liste
                      .filter((s) => s.jour === jour)
                      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
                    return (
                      <div key={jour} className="flex items-start gap-2 px-2 py-1.5">
                        <span className="w-20 shrink-0 pt-1 text-xs font-medium text-muted-foreground">
                          {nom}
                        </span>
                        <div className="flex flex-1 flex-wrap gap-1">
                          {duJour.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => setDialog({ slot: s, semaine, jour })}
                              title="Modifier"
                              className="rounded px-1.5 py-0.5 text-xs ring-1 ring-black/5 hover:ring-2 hover:ring-foreground/30"
                              style={{
                                backgroundColor: s.activityCouleur ?? "#e2e8f0",
                                color: texteSur(s.activityCouleur ?? "#e2e8f0"),
                              }}
                            >
                              <span className="font-semibold tabular-nums">
                                {s.heureDebut}–{s.heureFin}
                              </span>{" "}
                              {s.activityNom ?? "—"}
                            </button>
                          ))}
                          <button
                            onClick={() => setDialog({ slot: null, semaine, jour })}
                            title="Ajouter un créneau"
                            className="rounded border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                          >
                            <Plus className="inline h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dialog && (
        <SlotDialog
          workerId={workerId}
          reference={reference}
          contexte={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            charger();
          }}
          onDelete={async (s) => {
            setDialog(null);
            await supprimer(s);
          }}
        />
      )}

      {appliquerOuvert && (
        <AppliquerDialog
          workerId={workerId}
          nomVeto={nomVeto}
          onClose={() => setAppliquerOuvert(false)}
          onDone={(texte) => {
            setAppliquerOuvert(false);
            setMsg(texte);
          }}
        />
      )}

      {copieOuverte && (
        <CopieDialog
          slots={slots}
          workerId={workerId}
          onClose={() => setCopieOuverte(false)}
          onDone={() => {
            setCopieOuverte(false);
            charger();
          }}
        />
      )}
    </div>
  );
}

// ── Ajout / modification d'un créneau de semaine type ────────────────────────
function SlotDialog({
  workerId,
  reference,
  contexte,
  onClose,
  onSaved,
  onDelete,
}: {
  workerId: string;
  reference: ReferenceData;
  contexte: { slot: Slot | null; semaine: number; jour: number };
  onClose: () => void;
  onSaved: () => void;
  onDelete: (s: Slot) => void;
}) {
  const { slot } = contexte;
  const [form, setForm] = useState({
    semaine: slot?.semaine ?? contexte.semaine,
    jour: slot?.jour ?? contexte.jour,
    heureDebut: slot?.heureDebut ?? "09:00",
    heureFin: slot?.heureFin ?? "19:00",
    activityId: slot?.activityId ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(slot ? `/api/semaines-types/${slot.id}` : "/api/semaines-types", {
      method: slot ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, workerId, activityId: form.activityId || null }),
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
    <Dialog open onClose={onClose} title={slot ? "Modifier le créneau type" : "Nouveau créneau type"}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Semaine du roulement</Label>
            <Select
              value={form.semaine}
              onChange={(e) => setForm({ ...form, semaine: Number(e.target.value) })}
            >
              {SEMAINES.map((s) => (
                <option key={s} value={s}>
                  S{s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Jour</Label>
            <Select
              value={form.jour}
              onChange={(e) => setForm({ ...form, jour: Number(e.target.value) })}
            >
              {JOURS.map((j, i) => (
                <option key={j} value={i}>
                  {j}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Début</Label>
            <Input
              type="time"
              value={form.heureDebut}
              onChange={(e) => setForm({ ...form, heureDebut: e.target.value })}
            />
          </div>
          <div>
            <Label>Fin</Label>
            <Input
              type="time"
              value={form.heureFin}
              onChange={(e) => setForm({ ...form, heureFin: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Activité</Label>
          <Select
            value={form.activityId}
            onChange={(e) => setForm({ ...form, activityId: e.target.value })}
          >
            <option value="">— Aucune —</option>
            {reference.activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-danger">{error}</p>}
        <div className="flex items-center justify-between pt-1">
          {slot ? (
            <Button variant="danger" size="sm" onClick={() => onDelete(slot)} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ── Projection des semaines types sur le planning ────────────────────────────
function AppliquerDialog({
  workerId,
  nomVeto,
  onClose,
  onDone,
}: {
  workerId: string;
  nomVeto: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [cibles, setCibles] = useState<string[]>([]);
  const [remplacer, setRemplacer] = useState(true);
  const [toutLeMonde, setToutLeMonde] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/semaines-types/appliquer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lundis: cibles,
        remplacer,
        ...(toutLeMonde ? {} : { workerId }),
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Application impossible.");
      setBusy(false);
      return;
    }
    const rangs = (j.detail as { lundi: string; rang: number }[])
      .map((d) => `${d.lundi.slice(8, 10)}/${d.lundi.slice(5, 7)} → S${d.rang}`)
      .join(", ");
    onDone(
      `${j.crees} créneau(x) posés en brouillon (${rangs})` +
        (j.retires ? `, ${j.retires} remplacés.` : ".") +
        " Pensez à publier pour que l'équipe les voie.",
    );
  }

  return (
    <Dialog open onClose={onClose} title="Appliquer les semaines types au planning">
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Choisissez les semaines à remplir. Le rang du roulement (S1 à S4) de chaque semaine est
          déduit du calendrier de la clinique : c&apos;est la bonne semaine type qui est posée.
        </p>
        <WeekPicker
          selected={cibles}
          onToggle={(m) =>
            setCibles((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]))
          }
          sourceMonday={mondayOf(new Date().toISOString().slice(0, 10))}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={toutLeMonde}
            onChange={(e) => setToutLeMonde(e.target.checked)}
          />
          Appliquer pour toute l&apos;équipe (sinon : {nomVeto} seulement)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={remplacer}
            onChange={(e) => setRemplacer(e.target.checked)}
          />
          Vider d&apos;abord ces semaines (brouillon)
        </label>
        {error && <p className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={run} disabled={busy || cibles.length === 0}>
            {busy ? "Application…" : `Appliquer (${cibles.length})`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Copie d'une semaine type vers une autre ──────────────────────────────────
function CopieDialog({
  slots,
  workerId,
  onClose,
  onDone,
}: {
  slots: Slot[];
  workerId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [source, setSource] = useState(1);
  const [cible, setCible] = useState(2);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    // On vide la semaine cible puis on y recopie la source.
    for (const s of slots.filter((s) => s.semaine === cible)) {
      await fetch(`/api/semaines-types/${s.id}`, { method: "DELETE" });
    }
    for (const s of slots.filter((s) => s.semaine === source)) {
      await fetch("/api/semaines-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          semaine: cible,
          jour: s.jour,
          heureDebut: s.heureDebut,
          heureFin: s.heureFin,
          activityId: s.activityId,
        }),
      });
    }
    onDone();
  }

  return (
    <Dialog open onClose={onClose} title="Copier une semaine type">
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Pratique quand deux semaines du roulement sont identiques : la semaine cible est
          remplacée par la source.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Copier</Label>
            <Select value={source} onChange={(e) => setSource(Number(e.target.value))}>
              {SEMAINES.map((s) => (
                <option key={s} value={s}>
                  S{s} ({slots.filter((x) => x.semaine === s).length} créneaux)
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Vers</Label>
            <Select value={cible} onChange={(e) => setCible(Number(e.target.value))}>
              {SEMAINES.map((s) => (
                <option key={s} value={s}>
                  S{s}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={run} disabled={busy || source === cible}>
            {busy ? "Copie…" : "Copier"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
