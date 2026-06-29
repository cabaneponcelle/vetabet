// Garantit l'existence de l'activité « Congé » dans la base.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const ex = await p.activity.findFirst({ where: { nom: "Congé" } });
  if (!ex) {
    await p.activity.create({ data: { nom: "Congé", categorie: "Congés", couleur: "#BFBFBF" } });
    console.log("Activité Congé créée.");
  } else {
    console.log("Activité Congé déjà présente.");
  }
  await p.$disconnect();
})();
