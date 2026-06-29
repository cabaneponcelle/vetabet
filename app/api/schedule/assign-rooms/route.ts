import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/api";
import { dateStr } from "@/lib/schedule";
import { overlaps } from "@/lib/conflicts";

// POST /api/schedule/assign-rooms — attribue automatiquement une salle de
// consultation libre à chaque créneau « consultation » BROUILLON sans salle,
// en évitant toute double-réservation (algorithme glouton par date).
export async function POST() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  // Salles de consultation actives.
  const rooms = await prisma.room.findMany({
    where: { actif: true, type: { equals: "Consultation", mode: "insensitive" } },
    orderBy: { nom: "asc" },
  });
  if (rooms.length === 0) {
    return NextResponse.json({ error: "Aucune salle de type « Consultation » active." }, { status: 400 });
  }

  // Activités de consultation.
  const consultActs = await prisma.activity.findMany({
    where: { categorie: { equals: "Consultations", mode: "insensitive" } },
  });
  const consultActIds = new Set(consultActs.map((a) => a.id));

  // Tous les créneaux brouillon (pour connaître l'occupation des salles consult).
  const items = await prisma.scheduleItem.findMany({
    where: { status: "DRAFT" },
    orderBy: [{ date: "asc" }, { heureDebut: "asc" }],
  });

  // Occupation actuelle des salles de consultation : date -> liste {roomId, deb, fin}.
  const roomIds = new Set(rooms.map((r) => r.id));
  const occ = new Map<string, { roomId: string; deb: string; fin: string }[]>();
  for (const it of items) {
    if (it.roomId && roomIds.has(it.roomId)) {
      const d = dateStr(it.date);
      const arr = occ.get(d) ?? [];
      arr.push({ roomId: it.roomId, deb: it.heureDebut, fin: it.heureFin });
      occ.set(d, arr);
    }
  }

  // Créneaux à attribuer : activité de consultation + sans salle.
  const toAssign = items.filter((it) => it.activityId && consultActIds.has(it.activityId) && !it.roomId);

  let assigned = 0;
  let impossible = 0;
  for (const it of toAssign) {
    const d = dateStr(it.date);
    const arr = occ.get(d) ?? [];
    // Première salle libre sur ce créneau.
    const free = rooms.find(
      (r) => !arr.some((u) => u.roomId === r.id && overlaps(it.heureDebut, it.heureFin, u.deb, u.fin)),
    );
    if (!free) {
      impossible++;
      continue;
    }
    await prisma.scheduleItem.update({ where: { id: it.id }, data: { roomId: free.id } });
    arr.push({ roomId: free.id, deb: it.heureDebut, fin: it.heureFin });
    occ.set(d, arr);
    assigned++;
  }

  return NextResponse.json({ ok: true, assigned, impossible, salles: rooms.length });
}
