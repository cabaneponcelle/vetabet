import { prisma } from "@/lib/db";
import {
  detectConflicts,
  type Conflict,
  type ConflictItem,
  type WorkerInfo,
  type RoomInfo,
} from "@/lib/conflicts";
import type { ItemStatus, Prisma } from "@prisma/client";

// Inclusions communes pour récupérer les libellés (travailleur, salle, activité).
const itemInclude = {
  worker: { include: { user: true } },
  room: true,
  activity: true,
} satisfies Prisma.ScheduleItemInclude;

type ItemWithRelations = Prisma.ScheduleItemGetPayload<{ include: typeof itemInclude }>;

export interface SerializedItem {
  id: string;
  titre: string | null;
  description: string | null;
  date: string; // "YYYY-MM-DD"
  heureDebut: string;
  heureFin: string;
  status: ItemStatus;
  workerId: string | null;
  workerNom: string | null;
  roomId: string | null;
  roomNom: string | null;
  roomCouleur: string | null;
  activityId: string | null;
  activityNom: string | null;
  activityCouleur: string | null;
  updatedAt: string; // ISO — sert à détecter les modifications non publiées
}

export function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function workerName(it: ItemWithRelations): string | null {
  if (!it.worker) return null;
  return `${it.worker.user.prenom} ${it.worker.user.nom}`.trim();
}

export function serializeItem(it: ItemWithRelations): SerializedItem {
  return {
    id: it.id,
    titre: it.titre,
    description: it.description,
    date: dateStr(it.date),
    heureDebut: it.heureDebut,
    heureFin: it.heureFin,
    status: it.status,
    workerId: it.workerId,
    workerNom: workerName(it),
    roomId: it.roomId,
    roomNom: it.room?.nom ?? null,
    roomCouleur: it.room?.couleur ?? null,
    activityId: it.activityId,
    activityNom: it.activity?.nom ?? null,
    activityCouleur: it.activity?.couleur ?? null,
    updatedAt: it.updatedAt.toISOString(),
  };
}

interface LoadFilter {
  status?: ItemStatus;
  from?: string; // "YYYY-MM-DD"
  to?: string;
  workerId?: string;
  roomId?: string;
}

export async function loadItems(filter: LoadFilter = {}): Promise<SerializedItem[]> {
  const where: Prisma.ScheduleItemWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.workerId) where.workerId = filter.workerId;
  if (filter.roomId) where.roomId = filter.roomId;
  if (filter.from || filter.to) {
    where.date = {};
    if (filter.from) where.date.gte = new Date(`${filter.from}T00:00:00.000Z`);
    if (filter.to) where.date.lte = new Date(`${filter.to}T00:00:00.000Z`);
  }
  const items = await prisma.scheduleItem.findMany({
    where,
    include: itemInclude,
    orderBy: [{ date: "asc" }, { heureDebut: "asc" }],
  });
  return items.map(serializeItem);
}

// Calcule les conflits sur un périmètre de statut donné (par défaut : brouillon).
export async function loadConflicts(status: ItemStatus = "DRAFT"): Promise<Conflict[]> {
  const [items, workers, rooms] = await Promise.all([
    prisma.scheduleItem.findMany({ where: { status }, include: itemInclude }),
    prisma.worker.findMany({ include: { user: true, availabilities: true } }),
    prisma.room.findMany(),
  ]);

  const ci: ConflictItem[] = items.map((it) => ({
    id: it.id,
    date: dateStr(it.date),
    heureDebut: it.heureDebut,
    heureFin: it.heureFin,
    workerId: it.workerId,
    workerNom: workerName(it),
    roomId: it.roomId,
    roomNom: it.room?.nom ?? null,
    activityNom: it.activity?.nom ?? null,
  }));

  const wi: WorkerInfo[] = workers.map((w) => ({
    id: w.id,
    nom: `${w.user.prenom} ${w.user.nom}`.trim(),
    actif: w.actif && w.user.actif,
    availabilities: w.availabilities.map((a) => ({
      jourSemaine: a.jourSemaine,
      heureDebut: a.heureDebut,
      heureFin: a.heureFin,
    })),
  }));

  const ri: RoomInfo[] = rooms.map((r) => ({ id: r.id, nom: r.nom, actif: r.actif }));

  return detectConflicts(ci, wi, ri);
}
