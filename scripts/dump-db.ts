// Export complet de la base dans un fichier JSON (sauvegarde de sécurité avant
// une opération lourde : import, duplication en masse, migration…).
// Le fichier produit contient des données personnelles et des mots de passe
// chiffrés : le garder hors du dépôt et en lieu sûr.
//
//   npx tsx scripts/dump-db.ts <fichier.json>
//   DATABASE_URL=… npx tsx scripts/dump-db.ts <fichier.json>   (autre base)
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();

async function main() {
  const cible = process.argv[2];
  if (!cible) throw new Error("Usage : npx tsx scripts/dump-db.ts <fichier.json>");

  const dump = {
    exporteLe: new Date().toISOString(),
    users: await prisma.user.findMany(),
    workers: await prisma.worker.findMany(),
    availabilities: await prisma.availability.findMany(),
    rooms: await prisma.room.findMany(),
    activities: await prisma.activity.findMany(),
    scheduleItems: await prisma.scheduleItem.findMany(),
    complaints: await prisma.complaint.findMany(),
    leaveRequests: await prisma.leaveRequest.findMany(),
    settings: await prisma.setting.findMany(),
  };

  writeFileSync(cible, JSON.stringify(dump, null, 1), "utf-8");
  console.log(
    `Sauvegarde écrite : ${dump.scheduleItems.length} créneaux, ${dump.users.length} comptes, ` +
      `${dump.activities.length} activités, ${dump.leaveRequests.length} congés -> ${cible}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
