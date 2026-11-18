// Le planning publié d'une journée, personne par personne. Pratique pour
// vérifier après un import ce que l'équipe voit vraiment.
//
//   npx tsx scripts/journee.ts 2026-11-18
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const jour = process.argv[2] ?? new Date().toISOString().slice(0, 10);

  const items = await prisma.scheduleItem.findMany({
    where: { status: "PUBLISHED", date: new Date(`${jour}T00:00:00.000Z`) },
    select: {
      heureDebut: true,
      heureFin: true,
      worker: { select: { user: { select: { prenom: true } } } },
      activity: { select: { nom: true } },
    },
    orderBy: [{ heureDebut: "asc" }],
  });

  const parPersonne = new Map<string, string[]>();
  for (const i of items) {
    const nom = i.worker?.user.prenom ?? "(sans travailleur)";
    const l = parPersonne.get(nom) ?? [];
    l.push(`${i.heureDebut}–${i.heureFin} ${i.activity?.nom ?? "?"}`);
    parPersonne.set(nom, l);
  }

  console.log(`${jour} — ${items.length} créneaux publiés, ${parPersonne.size} personnes :`);
  for (const [nom, l] of [...parPersonne.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"))) {
    console.log(`  ${nom.padEnd(13)} ${l.join("  |  ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
