"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, CopyPlus, DoorOpen } from "lucide-react";
import { PlanningCalendar } from "@/components/planning-calendar";
import { ScheduleItemDialog, type DialogDefaults } from "@/components/schedule-item-dialog";
import { ConflictPanel } from "@/components/admin/conflict-panel";
import { PublishButton } from "@/components/admin/publish-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateFr } from "@/lib/utils";
import type { ReferenceData } from "@/lib/reference";
import type { SerializedItem } from "@/lib/schedule";
import type { Conflict } from "@/lib/conflicts";

function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // 0 = lundi
  return new Date(ms - dow * 86_400_000).toISOString().slice(0, 10);
}

export function PlanningClient({ reference }: { reference: ReferenceData }) {
  const [items, setItems] = useState<SerializedItem[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedItem | null>(null);
  const [defaults, setDefaults] = useState<DialogDefaults | undefined>();
  const [workerId, setWorkerId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [viewMonday, setViewMonday] = useState<string>(mondayOf(new Date().toISOString().slice(0, 10)));
  const [dupOpen, setDupOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ status: "DRAFT" });
    if (workerId) params.set("workerId", workerId);
    if (roomId) params.set("roomId", roomId);
    const [itemsRes, confRes] = await Promise.all([
      fetch(`/api/schedule-items?${params}`),
      fetch("/api/conflicts"),
    ]);
    if (itemsRes.ok) setItems(await itemsRes.json());
    if (confRes.ok) setConflicts(await confRes.json());
  }, [workerId, roomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openNew(d?: DialogDefaults) {
    setEditing(null);
    setDefaults(d);
    setDialogOpen(true);
  }
  function openEdit(it: SerializedItem) {
    setEditing(it);
    setDefaults(undefined);
    setDialogOpen(true);
  }

  async function assignRooms() {
    setBusy(true);
    try {
      const res = await fetch("/api/schedule/assign-rooms", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Erreur");
      alert(`Salles de consultation attribuées : ${j.assigned} créneau(x)${j.impossible ? `, ${j.impossible} sans salle libre` : ""}.`);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Planning global</h1>
            <p className="text-sm text-muted-foreground">
              Brouillon · cliquez une plage pour ajouter, un créneau pour modifier.
            </p>
          </div>
          <Button onClick={() => openNew()}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>

        {/* Filtres + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-44" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            <option value="">Tous les travailleurs</option>
            {reference.workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </Select>
          <Select className="w-44" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Toutes les salles</option>
            {reference.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => setDupOpen(true)}>
            <CopyPlus className="h-4 w-4" /> Dupliquer la semaine
          </Button>
          <Button variant="outline" onClick={assignRooms} disabled={busy}>
            <DoorOpen className="h-4 w-4" /> Attribuer salles consult
          </Button>
        </div>

        <Card>
          <CardContent>
            <PlanningCalendar
              items={items}
              onSelectSlot={openNew}
              onEventClick={openEdit}
              onDatesSet={(s) => setViewMonday(mondayOf(s))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <PublishButton conflicts={conflicts} onPublished={refresh} />
        <ConflictPanel conflicts={conflicts} compact />
      </div>

      <ScheduleItemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
        reference={reference}
        item={editing}
        defaults={defaults}
      />

      {dupOpen && (
        <DuplicateDialog
          sourceMonday={viewMonday}
          onClose={() => setDupOpen(false)}
          onDone={() => {
            setDupOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function DuplicateDialog({
  sourceMonday,
  onClose,
  onDone,
}: {
  sourceMonday: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [count, setCount] = useState(3);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/schedule/duplicate-week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceMonday, count, replace }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Erreur");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <Dialog open onClose={onClose} title="Dupliquer la semaine">
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Copie la semaine du <strong>{dateFr(sourceMonday)}</strong> (lundi → dimanche) vers les
          semaines suivantes. Pratique pour un roulement.
        </p>
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
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Remplacer les créneaux existants des semaines cibles
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
