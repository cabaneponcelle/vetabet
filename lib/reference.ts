import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Ordre d'affichage des travailleurs : le rang choisi par la RH d'abord, puis
// les fiches sans rang, par prénom. Utilisé partout (colonnes du planning,
// listes déroulantes) pour que l'équipe retrouve toujours le même ordre.
export const ORDRE_TRAVAILLEURS: Prisma.WorkerOrderByWithRelationInput[] = [
  { ordre: { sort: "asc", nulls: "last" } },
  { user: { prenom: "asc" } },
];

export interface RefOption {
  id: string;
  label: string;
  couleur?: string;
  actif?: boolean;
}

export interface ReferenceData {
  workers: RefOption[];
  rooms: RefOption[];
  activities: RefOption[];
}

// Données de référence pour alimenter les listes déroulantes des formulaires.
export async function getReferenceData(): Promise<ReferenceData> {
  const [workers, rooms, activities] = await Promise.all([
    prisma.worker.findMany({ include: { user: true }, orderBy: ORDRE_TRAVAILLEURS }),
    prisma.room.findMany({ orderBy: { nom: "asc" } }),
    prisma.activity.findMany({ orderBy: { nom: "asc" } }),
  ]);

  return {
    workers: workers.map((w) => ({
      id: w.id,
      label: `${w.user.prenom} ${w.user.nom}`.trim(),
      actif: w.actif && w.user.actif,
    })),
    rooms: rooms.map((r) => ({ id: r.id, label: r.nom, couleur: r.couleur, actif: r.actif })),
    activities: activities.map((a) => ({ id: a.id, label: a.nom, couleur: a.couleur })),
  };
}
