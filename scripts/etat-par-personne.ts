// Qui a des créneaux sur une période, et combien. Sert à repérer une personne
// entièrement absente d'un import (feuille oubliée, nom mal orthographié).
//
//   npx tsx scripts/etat-par-personne.ts 2027-01-04 2027-01-31
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [debutArg, finArg] = process.argv.slice(2);
  if (!debutArg || !finArg) throw new Error("usage : etat-par-personne.ts <debut> <fin>");

  const items = await prisma.scheduleItem.findMany({
    where: {
      date: { gte: new Date(`${debutArg}T00:00:00.000Z`), lte: new Date(`${finArg}T00:00:00.000Z`) },
    },
    select: { status: true, worker: { select: { user: { select: { prenom: true } } } } },
  });

  const parPersonne = new Map<string, { DRAFT: number; PUBLISHED: number }>();
  for (const it of items) {
    const nom = it.worker?.user.prenom ?? "(sans travailleur)";
    const e = parPersonne.get(nom) ?? { DRAFT: 0, PUBLISHED: 0 };
    e[it.status as "DRAFT" | "PUBLISHED"]++;
    parPersonne.set(nom, e);
  }

  console.log(`Du ${debutArg} au ${finArg} — brouillon / publié :`);
  for (const [nom, e] of [...parPersonne.entries()].sort((a, b) => b[1].DRAFT - a[1].DRAFT)) {
    console.log(`  ${nom.padEnd(14)} ${String(e.DRAFT).padStart(4)} / ${String(e.PUBLISHED).padStart(4)}`);
  }

  const tous = await prisma.worker.findMany({
    where: { actif: true },
    select: { user: { select: { prenom: true } } },
  });
  const absents = tous
    .map((w) => w.user.prenom)
    .filter((p) => !parPersonne.has(p))
    .sort();
  if (absents.length) console.log(`\nAucun créneau sur la période : ${absents.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
