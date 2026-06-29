// Remplace les disponibilités de tous les vétos par une plage large par défaut
// (tous les jours 07:00-23:00) pour repartir d'un planning sans faux conflits.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const workers = await p.worker.findMany();
  await p.availability.deleteMany({});
  for (const w of workers) {
    await p.availability.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((jour) => ({
        workerId: w.id,
        jourSemaine: jour,
        heureDebut: "07:00",
        heureFin: "23:00",
      })),
    });
  }
  console.log(`Disponibilités réinitialisées pour ${workers.length} vétos (7j, 07:00-23:00).`);
  await p.$disconnect();
})();
