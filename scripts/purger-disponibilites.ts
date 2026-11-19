// Vide la table Availability : les plages de disponibilité ne sont plus
// utilisées (l'équipe peut travailler à toute heure, le contrôle « hors
// disponibilité » a été retiré). Ces lignes ne servent plus à rien et
// alourdissent les sauvegardes.
//
//   DRY_RUN=1 npx tsx scripts/purger-disponibilites.ts
//   npx tsx scripts/purger-disponibilites.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1";

async function main() {
  const n = await prisma.availability.count();
  console.log(`${n} plage(s) de disponibilité en base${DRY ? "   [SIMULATION]" : ""}`);
  if (DRY || n === 0) return;

  const res = await prisma.availability.deleteMany({});
  console.log(`${res.count} plage(s) supprimée(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
