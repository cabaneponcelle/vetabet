// Créneaux rattachés à personne : il en reste quand un compte est supprimé
// (la relation passe à NULL). Ils n'apparaissent dans aucun planning mais
// continuent d'occuper la base.
//
//   npx tsx scripts/creneaux-orphelins.ts                        → inventaire
//   npx tsx scripts/creneaux-orphelins.ts --supprimer            → suppression
//   npx tsx scripts/creneaux-orphelins.ts --supprimer --avant 2026-08-01
//                                        → ne touche qu'aux créneaux passés
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const supprimer = process.argv.includes("--supprimer");
  const iAvant = process.argv.indexOf("--avant");
  const avant = iAvant >= 0 ? process.argv[iAvant + 1] : undefined;
  const filtre = {
    workerId: null,
    ...(avant ? { date: { lt: new Date(`${avant}T00:00:00.000Z`) } } : {}),
  };

  const orphelins = await prisma.scheduleItem.findMany({
    where: filtre,
    select: { id: true, date: true, status: true, activity: { select: { nom: true } } },
    orderBy: { date: "asc" },
  });

  if (orphelins.length === 0) {
    console.log("Aucun créneau orphelin.");
    return;
  }

  const parMois = new Map<string, number>();
  for (const o of orphelins) {
    const m = o.date.toISOString().slice(0, 7);
    parMois.set(m, (parMois.get(m) ?? 0) + 1);
  }
  console.log(`${orphelins.length} créneaux sans travailleur :`);
  for (const [m, n] of [...parMois.entries()].sort()) console.log(`  ${m}  ${n}`);

  if (!supprimer) {
    console.log("\n(relancer avec --supprimer pour les retirer)");
    return;
  }

  const res = await prisma.scheduleItem.deleteMany({ where: filtre });
  console.log(`\n${res.count} créneaux orphelins supprimés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
