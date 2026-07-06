// Migration de données : copie TOUTES les tables de la base source (prod
// Netlify US) vers la base cible (Neon EU) en préservant les identifiants.
// La cible est vidée d'abord. Usage :
//   SOURCE_URL=... TARGET_URL=... npx tsx scripts/migrate-eu.ts
import { PrismaClient } from "@prisma/client";

const source = new PrismaClient({ datasourceUrl: process.env.SOURCE_URL });
const target = new PrismaClient({ datasourceUrl: process.env.TARGET_URL });

async function main() {
  console.log("Lecture de la source…");
  const [users, workers, availabilities, rooms, activities, scheduleItems, complaints, leaveRequests, settings] =
    await Promise.all([
      source.user.findMany(),
      source.worker.findMany(),
      source.availability.findMany(),
      source.room.findMany(),
      source.activity.findMany(),
      source.scheduleItem.findMany(),
      source.complaint.findMany(),
      source.leaveRequest.findMany(),
      source.setting.findMany(),
    ]);
  console.log(
    `Source : ${users.length} users, ${workers.length} workers, ${availabilities.length} dispos, ` +
      `${rooms.length} salles, ${activities.length} activités, ${scheduleItems.length} créneaux, ` +
      `${complaints.length} réclamations, ${leaveRequests.length} congés, ${settings.length} settings`,
  );

  console.log("Vidage de la cible…");
  await target.complaint.deleteMany({});
  await target.leaveRequest.deleteMany({});
  await target.scheduleItem.deleteMany({});
  await target.availability.deleteMany({});
  await target.worker.deleteMany({});
  await target.user.deleteMany({});
  await target.room.deleteMany({});
  await target.activity.deleteMany({});
  await target.setting.deleteMany({});

  console.log("Insertion dans la cible…");
  await target.user.createMany({ data: users });
  await target.worker.createMany({ data: workers });
  await target.availability.createMany({ data: availabilities });
  await target.room.createMany({ data: rooms });
  await target.activity.createMany({ data: activities });
  await target.scheduleItem.createMany({ data: scheduleItems });
  await target.complaint.createMany({ data: complaints });
  await target.leaveRequest.createMany({ data: leaveRequests });
  await target.setting.createMany({ data: settings });

  // Vérification des comptes.
  const check = await Promise.all([
    target.user.count(),
    target.scheduleItem.count(),
    target.complaint.count(),
  ]);
  console.log(`✅ Cible : ${check[0]} users, ${check[1]} créneaux, ${check[2]} réclamations.`);
  if (check[0] !== users.length || check[1] !== scheduleItems.length) {
    throw new Error("Comptes source/cible différents — vérifier !");
  }
  console.log("Migration terminée avec succès.");
}

main()
  .catch((e) => {
    console.error("ERREUR:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
