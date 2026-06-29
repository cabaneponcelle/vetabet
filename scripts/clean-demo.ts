// Nettoie l'état de démo : retire les créneaux Congé, les demandes de congé,
// et la semaine dupliquée du 27/07/2026.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const conge = await p.activity.findFirst({ where: { nom: "Congé" } });
  const delConge = conge
    ? await p.scheduleItem.deleteMany({ where: { activityId: conge.id } })
    : { count: 0 };
  const delLeaves = await p.leaveRequest.deleteMany({});
  const delDup = await p.scheduleItem.deleteMany({
    where: {
      status: "DRAFT",
      date: { gte: new Date("2026-07-27T00:00:00Z"), lte: new Date("2026-08-02T00:00:00Z") },
    },
  });

  const draft = await p.scheduleItem.count({ where: { status: "DRAFT" } });
  console.log(
    `Nettoyé : ${delConge.count} créneaux Congé, ${delLeaves.count} demandes de congé, ${delDup.count} créneaux semaine 27/07. Reste ${draft} créneaux brouillon.`,
  );
  await p.$disconnect();
})();
