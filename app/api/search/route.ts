import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/api";
import { dateStr } from "@/lib/schedule";

// GET /api/search?q= — recherche transversale (travailleurs, salles, créneaux,
// activités, dates). Réservée à la RH.
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) return NextResponse.json({ workers: [], rooms: [], items: [], activities: [] });

  const [workers, rooms, activities, items] = await Promise.all([
    prisma.worker.findMany({ include: { user: true } }),
    prisma.room.findMany(),
    prisma.activity.findMany(),
    prisma.scheduleItem.findMany({
      include: { worker: { include: { user: true } }, room: true, activity: true },
      orderBy: [{ date: "asc" }, { heureDebut: "asc" }],
      take: 200,
    }),
  ]);

  const matchWorkers = workers
    .filter((w) => `${w.user.prenom} ${w.user.nom} ${w.user.email} ${w.fonction ?? ""}`.toLowerCase().includes(q))
    .map((w) => ({ id: w.id, label: `${w.user.prenom} ${w.user.nom}`.trim(), email: w.user.email, actif: w.actif && w.user.actif }));

  const matchRooms = rooms
    .filter((r) => `${r.nom} ${r.type ?? ""}`.toLowerCase().includes(q))
    .map((r) => ({ id: r.id, label: r.nom, type: r.type, actif: r.actif }));

  const matchActivities = activities
    .filter((a) => `${a.nom} ${a.categorie ?? ""}`.toLowerCase().includes(q))
    .map((a) => ({ id: a.id, label: a.nom, categorie: a.categorie, couleur: a.couleur }));

  const matchItems = items
    .filter((it) => {
      const wn = it.worker ? `${it.worker.user.prenom} ${it.worker.user.nom}` : "";
      const hay = `${it.titre ?? ""} ${dateStr(it.date)} ${wn} ${it.room?.nom ?? ""} ${it.activity?.nom ?? ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 50)
    .map((it) => ({
      id: it.id,
      titre: it.titre,
      date: dateStr(it.date),
      heureDebut: it.heureDebut,
      heureFin: it.heureFin,
      status: it.status,
      workerNom: it.worker ? `${it.worker.user.prenom} ${it.worker.user.nom}`.trim() : null,
      roomNom: it.room?.nom ?? null,
      activityNom: it.activity?.nom ?? null,
    }));

  return NextResponse.json({
    workers: matchWorkers,
    rooms: matchRooms,
    activities: matchActivities,
    items: matchItems,
  });
}
