"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Users, DoorOpen, CalendarDays, Tag, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dateFr } from "@/lib/utils";

interface Results {
  workers: { id: string; label: string; email: string; actif: boolean }[];
  rooms: { id: string; label: string; type: string | null; actif: boolean }[];
  activities: { id: string; label: string; categorie: string | null; couleur: string }[];
  items: {
    id: string;
    titre: string | null;
    date: string;
    heureDebut: string;
    heureFin: string;
    status: string;
    workerNom: string | null;
    roomNom: string | null;
    activityNom: string | null;
  }[];
}

const EMPTY: Results = { workers: [], rooms: [], activities: [], items: [] };

export function SearchClient() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setRes(EMPTY);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (r.ok) setRes(await r.json());
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const total = res.workers.length + res.rooms.length + res.activities.length + res.items.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Recherche</h1>
        <p className="text-sm text-muted-foreground">
          Travailleur, salle, créneau, date ou activité.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <Link href="/admin/travailleurs">
          <Button variant="outline">
            <Plus className="h-4 w-4" /> Travailleur
          </Button>
        </Link>
        <Link href="/admin/salles">
          <Button variant="outline">
            <Plus className="h-4 w-4" /> Salle
          </Button>
        </Link>
      </div>

      {q.trim() && (
        <p className="text-xs text-muted-foreground">
          {loading ? "Recherche…" : `${total} résultat(s)`}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" /> Travailleurs ({res.workers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {res.workers.map((w) => (
              <Link
                key={w.id}
                href="/admin/travailleurs"
                className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:bg-muted"
              >
                <span>{w.label}</span>
                <Badge variant={w.actif ? "success" : "default"}>{w.actif ? "Actif" : "Inactif"}</Badge>
              </Link>
            ))}
            {res.workers.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <DoorOpen className="h-4 w-4" /> Salles ({res.rooms.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {res.rooms.map((r) => (
              <Link
                key={r.id}
                href="/admin/salles"
                className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:bg-muted"
              >
                <span>{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.type ?? ""}</span>
              </Link>
            ))}
            {res.rooms.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4" /> Activités ({res.activities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {res.activities.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: a.couleur }} />
                {a.label}
                <span className="ml-auto text-xs text-muted-foreground">{a.categorie}</span>
              </div>
            ))}
            {res.activities.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4" /> Créneaux ({res.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {res.items.map((it) => (
              <Link
                key={it.id}
                href="/admin/planning"
                className="block rounded-md border border-border p-2 text-sm hover:bg-muted"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {dateFr(it.date)} · {it.heureDebut}-{it.heureFin}
                  </span>
                  <Badge variant={it.status === "PUBLISHED" ? "primary" : "default"}>
                    {it.status === "PUBLISHED" ? "Publié" : "Brouillon"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {[it.workerNom, it.roomNom, it.titre || it.activityNom].filter(Boolean).join(" · ")}
                </div>
              </Link>
            ))}
            {res.items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
