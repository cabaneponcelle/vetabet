import { prisma } from "@/lib/db";

// Congés : un congé approuvé pose des créneaux « Congé » sur toute la période,
// ce qui rend visible l'absence dans le planning et déclenche une incohérence
// si la personne est quand même planifiée ailleurs ce jour-là.

const JOUR_MS = 86_400_000;

export async function congeActivityId(): Promise<string> {
  const existante = await prisma.activity.findFirst({ where: { nom: "Congé" } });
  if (existante) return existante.id;
  const creee = await prisma.activity.create({
    data: { nom: "Congé", categorie: "Congés", couleur: "#BFBFBF" },
  });
  return creee.id;
}

/**
 * Met le planning en accord avec la décision prise sur un congé : retire les
 * créneaux « Congé » déjà posés sur la période, puis les recrée si le congé
 * est approuvé. Renvoie le nombre de journées posées.
 */
export async function appliquerConge(
  leave: { workerId: string; dateDebut: Date; dateFin: Date },
  approuve: boolean,
): Promise<number> {
  const activityId = await congeActivityId();
  const debut = leave.dateDebut.getTime();
  const fin = leave.dateFin.getTime();

  await prisma.scheduleItem.deleteMany({
    where: {
      workerId: leave.workerId,
      activityId,
      date: { gte: new Date(debut), lte: new Date(fin) },
    },
  });

  if (!approuve) return 0;

  const jours = [];
  for (let ms = debut; ms <= fin; ms += JOUR_MS) {
    jours.push({
      titre: "Congé",
      date: new Date(ms),
      heureDebut: "07:00",
      heureFin: "23:00",
      status: "DRAFT" as const,
      workerId: leave.workerId,
      activityId,
      createdBy: "leave",
    });
  }
  const res = await prisma.scheduleItem.createMany({ data: jours });
  return res.count;
}
