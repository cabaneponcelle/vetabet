import { prisma } from "@/lib/db";

// Semaines types : le modèle de roulement de chaque vétérinaire (S1 à S4).
// Le planning réel en est la projection sur des dates ; le modifier ne touche
// à rien tant qu'on ne l'applique pas à des semaines.

export interface SerializedTemplateSlot {
  id: string;
  workerId: string;
  workerNom: string | null;
  semaine: number; // 1 à 4
  jour: number; // 0 = lundi … 6 = dimanche
  heureDebut: string;
  heureFin: string;
  activityId: string | null;
  activityNom: string | null;
  activityCouleur: string | null;
}

const inclure = {
  worker: { include: { user: true } },
  activity: true,
} as const;

type AvecRelations = Awaited<
  ReturnType<typeof prisma.templateSlot.findMany<{ include: typeof inclure }>>
>[number];

export function serializeTemplateSlot(t: AvecRelations): SerializedTemplateSlot {
  return {
    id: t.id,
    workerId: t.workerId,
    workerNom: t.worker ? `${t.worker.user.prenom} ${t.worker.user.nom}`.trim() : null,
    semaine: t.semaine,
    jour: t.jour,
    heureDebut: t.heureDebut,
    heureFin: t.heureFin,
    activityId: t.activityId,
    activityNom: t.activity?.nom ?? null,
    activityCouleur: t.activity?.couleur ?? null,
  };
}

export async function loadTemplateSlots(workerId?: string): Promise<SerializedTemplateSlot[]> {
  const slots = await prisma.templateSlot.findMany({
    where: workerId ? { workerId } : {},
    include: inclure,
    orderBy: [{ semaine: "asc" }, { jour: "asc" }, { heureDebut: "asc" }],
  });
  return slots.map(serializeTemplateSlot);
}

/**
 * Projette les semaines types sur de vraies semaines du calendrier.
 * Renvoie les créneaux à créer (brouillon) ; le rang du roulement de chaque
 * semaine est calculé par l'appelant.
 */
export function creneauxDepuisTemplate(
  slots: SerializedTemplateSlot[],
  lundi: string,
  rang: number,
  createdBy: string,
) {
  const [y, m, d] = lundi.split("-").map(Number);
  return slots
    .filter((s) => s.semaine === rang)
    .map((s) => ({
      titre: null,
      description: null,
      date: new Date(Date.UTC(y, m - 1, d) + s.jour * 86_400_000),
      heureDebut: s.heureDebut,
      heureFin: s.heureFin,
      status: "DRAFT" as const,
      workerId: s.workerId,
      roomId: null,
      activityId: s.activityId,
      createdBy,
    }));
}
