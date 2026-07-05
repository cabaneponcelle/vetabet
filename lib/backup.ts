import { prisma } from "@/lib/db";

// Construit une sauvegarde complète de la base (toutes les tables) sous forme
// d'objet JSON, restaurable. Contient des données sensibles (mots de passe
// hashés) : le fichier produit doit être conservé en lieu sûr.
export async function buildBackup() {
  const [
    users,
    workers,
    availabilities,
    rooms,
    activities,
    scheduleItems,
    complaints,
    leaveRequests,
    settings,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.worker.findMany(),
    prisma.availability.findMany(),
    prisma.room.findMany(),
    prisma.activity.findMany(),
    prisma.scheduleItem.findMany(),
    prisma.complaint.findMany(),
    prisma.leaveRequest.findMany(),
    prisma.setting.findMany(),
  ]);

  return {
    application: "vetelio",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      users,
      workers,
      availabilities,
      rooms,
      activities,
      scheduleItems,
      complaints,
      leaveRequests,
      settings,
    },
  };
}
