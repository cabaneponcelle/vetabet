"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Eraser,
  EyeOff,
  PenLine,
  Plus,
} from "lucide-react";
import { ScheduleItemDialog, type DialogDefaults } from "@/components/schedule-item-dialog";
import { WeekPicker } from "@/components/admin/week-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addDaysStr, dateFr, mondayOf } from "@/lib/utils";
import { conflictKey, type Conflict } from "@/lib/conflicts";
import type { ReferenceData } from "@/lib/reference";
import type { SerializedItem } from "@/lib/schedule";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function ddmm(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}
function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
// 510 -> "8 h 30", 480 -> "8 h"
function duree(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Constructeur de semaine pour UNE personne : on choisit le vétérinaire, on
 * remplit ses journées à partir d'un « créneau modèle » (un clic par jour),
 * puis on duplique la semaine obtenue sur les semaines suivantes — sans jamais
 * toucher au planning des autres.
 */
export function WorkerWeekClient({
  reference,
  initialWorkerId,
}: {
  reference: ReferenceData;
  initialWorkerId?: string;
}) {
  const [workerId, setWorkerId] = useState(initialWorkerId ?? "");
  const [viewMonday, setViewMonday] = useState<string>(mondayOf(today()));
  const [items, setItems] = useState<SerializedItem[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Créneau « modèle » : ce qui sera ajouté d'un clic sur le + d'un jour.
  const [modele, setModele] = useState({
    activityId: "",
    roomId: "",
    heureDebut: "08:00",
    heureFin: "13:00",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedItem | null>(null);
  const [defaults, setDefaults] = useState<DialogDefaults | undefined>();
  const [dupOpen, setDupOpen] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysStr(viewMonday, i)),
    [viewMonday],
  );
  const workerLabel = reference.workers.find((w) => w.id === workerId)?.label ?? "";

  const refresh = useCallback(async () => {
    if (!workerId) {
      setItems([]);
      setConflicts([]);
      return;
    }
    const from = viewMonday;
    const to = addDaysStr(viewMonday, 6);
    const [itemsRes, confRes] = await Promise.all([
      fetch(`/api/schedule-items?status=DRAFT&workerId=${workerId}&from=${from}&to=${to}`),
      fetch("/api/conflicts"),
    ]);
    if (itemsRes.ok) setItems(await itemsRes.json());
    if (confRes.ok) setConflicts(await confRes.json());
  }, [workerId, viewMonday]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byDay = useMemo(() => {
    const map = new Map<string, SerializedItem[]>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
    return map;
  }, [items]);

  // Incohérences concernant les créneaux affichés (semaine + personne).
  const weekConflicts = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    return conflicts.filter((c) => c.itemIds.some((id) => ids.has(id)));
  }, [conflicts, items]);
  const visibleConflicts = weekConflicts.filter((c) => !c.ignored);
  const ignoredConflicts = weekConflicts.filter((c) => c.ignored).length;

  async function ignorer(c: Conflict) {
    setBusy(true);
    const res = await fetch("/api/conflicts/ignore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: conflictKey(c), ignored: true }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: j.error ?? "Impossible d'ignorer cet avertissement." });
    }
    setBusy(false);
    refresh();
  }

  const totalMin = items.reduce(
    (sum, it) => sum + Math.max(0, minutes(it.heureFin) - minutes(it.heureDebut)),
    0,
  );

  async function ajouterModele(date: string) {
    if (!workerId) return;
    if (minutes(modele.heureFin) <= minutes(modele.heureDebut)) {
      setMsg({ ok: false, text: "L'heure de fin du créneau modèle doit être après l'heure de début." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/schedule-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          heureDebut: modele.heureDebut,
          heureFin: modele.heureFin,
          workerId,
          roomId: modele.roomId || null,
          activityId: modele.activityId || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Erreur lors de l'ajout du créneau.");
      }
      await refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur lors de l'ajout." });
    } finally {
      setBusy(false);
    }
  }

  async function viderSemaine() {
    if (items.length === 0) return;
    if (
      !confirm(
        `Supprimer les ${items.length} créneau(x) de ${workerLabel} pour la semaine du ${dateFr(viewMonday)} ?`,
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      for (const it of items) {
        await fetch(`/api/schedule-items/${it.id}`, { method: "DELETE" });
      }
      await refresh();
      setMsg({ ok: true, text: "Semaine vidée." });
    } finally {
      setBusy(false);
    }
  }

  function openNew(date: string) {
    setEditing(null);
    setDefaults({
      date,
      heureDebut: modele.heureDebut,
      heureFin: modele.heureFin,
      workerId,
      roomId: modele.roomId,
      activityId: modele.activityId,
    });
    setDialogOpen(true);
  }
  function openEdit(it: SerializedItem) {
    setEditing(it);
    setDefaults(undefined);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Semaine d&apos;une personne</h1>
        <p className="text-sm text-muted-foreground">
          Construisez la semaine type d&apos;un vétérinaire, puis dupliquez-la sur les semaines
          suivantes. Seuls ses créneaux sont concernés.
        </p>
      </div>

      {/* Personne + navigation de semaine */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-56"
          value={workerId}
          onChange={(e) => {
            setWorkerId(e.target.value);
            setMsg(null);
          }}
        >
          <option value="">— Choisir une personne —</option>
          {reference.workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
              {w.actif === false ? " (inactif)" : ""}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setViewMonday(addDaysStr(viewMonday, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewMonday(mondayOf(today()))}>
            Aujourd&apos;hui
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewMonday(addDaysStr(viewMonday, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm font-semibold">
          Semaine du {ddmm(viewMonday)} au {ddmm(addDaysStr(viewMonday, 6))}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {items.length} créneau(x) · {duree(totalMin)}
          </span>
          <Button variant="outline" onClick={() => setDupOpen(true)} disabled={!workerId || items.length === 0}>
            <CopyPlus className="h-4 w-4" /> Dupliquer la semaine
          </Button>
          <Button variant="outline" onClick={viderSemaine} disabled={busy || items.length === 0}>
            <Eraser className="h-4 w-4" /> Vider la semaine
          </Button>
        </div>
      </div>

      {!workerId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Choisissez une personne pour commencer — par exemple pour construire la semaine type
            d&apos;Anne, puis la recopier sur le mois.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Créneau modèle */}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Activité</Label>
                <Select
                  className="w-52"
                  value={modele.activityId}
                  onChange={(e) => setModele((m) => ({ ...m, activityId: e.target.value }))}
                >
                  <option value="">— Aucune —</option>
                  {reference.activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Salle</Label>
                <Select
                  className="w-52"
                  value={modele.roomId}
                  onChange={(e) => setModele((m) => ({ ...m, roomId: e.target.value }))}
                >
                  <option value="">— Aucune —</option>
                  {reference.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                      {r.actif === false ? " (inactive)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Début</Label>
                <Input
                  type="time"
                  className="w-28"
                  value={modele.heureDebut}
                  onChange={(e) => setModele((m) => ({ ...m, heureDebut: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fin</Label>
                <Input
                  type="time"
                  className="w-28"
                  value={modele.heureFin}
                  onChange={(e) => setModele((m) => ({ ...m, heureFin: e.target.value }))}
                />
              </div>
              <p className="flex-1 text-xs text-muted-foreground">
                Réglez ce créneau, puis cliquez sur <strong>Ajouter</strong> dans chaque jour
                concerné. Le crayon ouvre le formulaire complet (titre, note…).
              </p>
            </CardContent>
          </Card>

          {msg && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
            >
              {msg.text}
            </p>
          )}

          {/* Les 7 jours */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {days.map((d, i) => {
              const dayItems = byDay.get(d) ?? [];
              const dayMin = dayItems.reduce(
                (s, it) => s + Math.max(0, minutes(it.heureFin) - minutes(it.heureDebut)),
                0,
              );
              return (
                <Card key={d} className={d === today() ? "border-primary/60" : undefined}>
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold">{JOURS[i]}</span>
                      <span className="text-xs text-muted-foreground">{ddmm(d)}</span>
                    </div>

                    {dayItems.length === 0 ? (
                      <p className="py-2 text-center text-xs text-muted-foreground">Rien de prévu</p>
                    ) : (
                      <div className="space-y-1">
                        {dayItems.map((it) => (
                          <button
                            key={it.id}
                            onClick={() => openEdit(it)}
                            title="Modifier ce créneau"
                            className="w-full rounded px-1.5 py-1 text-left text-xs leading-tight"
                            style={{
                              backgroundColor: it.activityCouleur || it.roomCouleur || "#e2e8f0",
                              borderLeft: `4px solid ${it.roomCouleur || it.activityCouleur || "#94a3b8"}`,
                              color: "#0f172a",
                            }}
                          >
                            <span className="font-semibold">
                              {it.heureDebut}–{it.heureFin}
                            </span>{" "}
                            <span>{it.activityNom ?? it.titre ?? ""}</span>
                            {it.roomNom && <span className="block opacity-70">{it.roomNom}</span>}
                          </button>
                        ))}
                        <p className="text-right text-[10px] text-muted-foreground">{duree(dayMin)}</p>
                      </div>
                    )}

                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => ajouterModele(d)}
                        disabled={busy}
                      >
                        <Plus className="h-3.5 w-3.5" /> Ajouter
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Créneau détaillé…"
                        onClick={() => openNew(d)}
                      >
                        <PenLine className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Incohérences de la semaine affichée */}
          <Card>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Incohérences sur cette semaine
              </div>
              {visibleConflicts.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Aucune incohérence pour {workerLabel} cette
                  semaine.
                </p>
              ) : (
                visibleConflicts.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-1.5 rounded-md border p-2 text-xs ${
                      c.severite === "BLOQUANT"
                        ? "border-danger/30 bg-danger/5"
                        : "border-warning/30 bg-warning/5"
                    }`}
                  >
                    {c.severite === "BLOQUANT" ? (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    )}
                    <span className="flex-1 text-muted-foreground">{c.message}</span>
                    {c.severite === "AVERTISSEMENT" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Masquer cet avertissement"
                        disabled={busy}
                        onClick={() => ignorer(c)}
                      >
                        <EyeOff className="h-3.5 w-3.5" /> Ignorer
                      </Button>
                    )}
                  </div>
                ))
              )}
              {ignoredConflicts > 0 && (
                <p className="text-xs text-muted-foreground">
                  {ignoredConflicts} avertissement(s) ignoré(s) cette semaine — réaffichables dans
                  la rubrique Incohérences.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Ces créneaux restent en brouillon : publiez le planning pour que l&apos;équipe les
                voie.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <ScheduleItemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
        reference={reference}
        item={editing}
        defaults={defaults}
      />

      {dupOpen && (
        <DuplicateWorkerWeekDialog
          workerId={workerId}
          workerLabel={workerLabel}
          sourceMonday={viewMonday}
          onClose={() => setDupOpen(false)}
          onDone={(text) => {
            setDupOpen(false);
            setMsg({ ok: true, text });
            refresh();
          }}
        />
      )}
    </div>
  );
}

function DuplicateWorkerWeekDialog({
  workerId,
  workerLabel,
  sourceMonday,
  onClose,
  onDone,
}: {
  workerId: string;
  workerLabel: string;
  sourceMonday: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<"suivantes" | "calendrier">("suivantes");
  const [count, setCount] = useState(3);
  const [choisies, setChoisies] = useState<string[]>([]);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Semaines cibles selon le mode choisi.
  const targetMondays =
    mode === "suivantes"
      ? Array.from({ length: count }, (_, i) => addDaysStr(sourceMonday, (i + 1) * 7))
      : [...choisies].sort();

  function toggleSemaine(monday: string) {
    setChoisies((prev) =>
      prev.includes(monday) ? prev.filter((m) => m !== monday) : [...prev, monday],
    );
  }

  async function run() {
    if (targetMondays.length === 0) {
      setError("Choisissez au moins une semaine dans le calendrier.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/schedule/duplicate-worker-week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId, sourceMonday, targetMondays, replace }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Erreur lors de la duplication.");
      setBusy(false);
      return;
    }
    onDone(
      `✅ Semaine de ${workerLabel} recopiée sur ${j.weeks} semaine(s) — ${j.created} créneau(x) créé(s).`,
    );
  }

  return (
    <Dialog open onClose={onClose} title={`Dupliquer la semaine de ${workerLabel}`}>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Copie les créneaux de <strong>{workerLabel}</strong> de la semaine du{" "}
          <strong>{dateFr(sourceMonday)}</strong> (lundi → dimanche). Le planning des autres
          personnes n&apos;est pas modifié.
        </p>

        <div className="flex overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={() => setMode("suivantes")}
            className={`flex-1 px-3 py-1.5 text-sm ${mode === "suivantes" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            Les semaines suivantes
          </button>
          <button
            type="button"
            onClick={() => setMode("calendrier")}
            className={`flex-1 px-3 py-1.5 text-sm ${mode === "calendrier" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            Choisir dans le calendrier
          </button>
        </div>

        {mode === "suivantes" ? (
          <div>
            <Label>Nombre de semaines suivantes à remplir</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={count}
              onChange={(e) => setCount(Math.min(12, Math.max(1, Number(e.target.value))))}
            />
          </div>
        ) : (
          <WeekPicker selected={choisies} onToggle={toggleSemaine} sourceMonday={sourceMonday} />
        )}

        <p className="text-xs text-muted-foreground">
          {targetMondays.length === 0
            ? "Aucune semaine choisie."
            : `${targetMondays.length} semaine(s) : ${targetMondays
                .map((m) => `${m.slice(8)}/${m.slice(5, 7)}`)
                .join(", ")}`}
        </p>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Remplacer ses créneaux existants dans les semaines cibles
        </label>
        {error && <p className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={run} disabled={busy}>
            {busy ? "Duplication…" : "Dupliquer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
