import { prisma } from "@/lib/db";
import { dateStr } from "@/lib/schedule";

// ─────────────────────────────────────────────────────────────────────────────
//  « Bourse aux gardes » : un créneau devient « à reprendre » quand son
//  titulaire a un congé APPROUVÉ couvrant la date du créneau (et que le
//  créneau n'est pas lui-même le bloc « Congé »). Les autres vétérinaires
//  peuvent alors le reprendre en un clic.
// ─────────────────────────────────────────────────────────────────────────────

export interface GardeReprenable {
  id: string;
  date: string; // "YYYY-MM-DD"
  heureDebut: string;
  heureFin: string;
  titre: string | null;
  activityNom: string | null;
  activityCouleur: string | null;
  roomNom: string | null;
  workerId: string;
  workerNom: string; // titulaire en congé
}

// Liste des créneaux (brouillon = source de vérité) reprenables à partir d'aujourd'hui.
export async function loadGardesReprenables(): Promise<GardeReprenable[]> {
  const today = new Date().toISOString().slice(0, 10);

  const leaves = await prisma.leaveRequest.findMany({
    where: { status: "APPROUVE", dateFin: { gte: new Date(`${today}T00:00:00.000Z`) } },
  });
  if (leaves.length === 0) return [];

  const workerIds = [...new Set(leaves.map((l) => l.workerId))];
  const items = await prisma.scheduleItem.findMany({
    where: {
      status: "DRAFT",
      workerId: { in: workerIds },
      date: { gte: new Date(`${today}T00:00:00.000Z`) },
    },
    include: { worker: { include: { user: true } }, room: true, activity: true },
    orderBy: [{ date: "asc" }, { heureDebut: "asc" }],
  });

  const out: GardeReprenable[] = [];
  for (const it of items) {
    if (!it.workerId || !it.worker) continue;
    if (it.activity?.nom === "Congé") continue; // le bloc congé lui-même
    const d = dateStr(it.date);
    const enConge = leaves.some(
      (l) => l.workerId === it.workerId && dateStr(l.dateDebut) <= d && dateStr(l.dateFin) >= d,
    );
    if (!enConge) continue;
    out.push({
      id: it.id,
      date: d,
      heureDebut: it.heureDebut,
      heureFin: it.heureFin,
      titre: it.titre,
      activityNom: it.activity?.nom ?? null,
      activityCouleur: it.activity?.couleur ?? null,
      roomNom: it.room?.nom ?? null,
      workerId: it.workerId,
      workerNom: `${it.worker.user.prenom} ${it.worker.user.nom}`.trim(),
    });
  }
  return out;
}
