// ─────────────────────────────────────────────────────────────────────────────
//  État du planning : combien de créneaux en brouillon et combien publiés,
//  jour par jour. Sert à répondre à « je ne vois rien pour telle date » :
//  les créneaux sont-ils absents, ou présents mais seulement en brouillon ?
//
//    npx tsx scripts/etat-planning.ts                  → vue d'ensemble
//    npx tsx scripts/etat-planning.ts 2026-11-01 2026-11-30   → détail par jour
//    DATABASE_URL=… npx tsx scripts/etat-planning.ts   → sur une autre base
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function jour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const [debutArg, finArg] = process.argv.slice(2);

  const total = await prisma.scheduleItem.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log("Total en base :");
  for (const t of total) console.log(`  ${t.status.padEnd(10)} ${t._count._all}`);

  const pub = await prisma.setting.findUnique({ where: { cle: "derniere_publication" } });
  console.log(`Dernière publication : ${pub?.valeur ?? "jamais"}`);

  // Vue d'ensemble par mois.
  const tous = await prisma.scheduleItem.findMany({ select: { date: true, status: true } });
  const parMois = new Map<string, { DRAFT: number; PUBLISHED: number }>();
  for (const it of tous) {
    const m = jour(it.date).slice(0, 7);
    const e = parMois.get(m) ?? { DRAFT: 0, PUBLISHED: 0 };
    e[it.status as "DRAFT" | "PUBLISHED"]++;
    parMois.set(m, e);
  }
  console.log("\nPar mois (brouillon / publié) :");
  for (const m of [...parMois.keys()].sort()) {
    const e = parMois.get(m)!;
    const alerte = e.PUBLISHED < e.DRAFT ? "   ⚠ non publié en totalité" : "";
    console.log(`  ${m}   ${String(e.DRAFT).padStart(5)} / ${String(e.PUBLISHED).padStart(5)}${alerte}`);
  }

  if (!debutArg || !finArg) return;

  const debut = new Date(`${debutArg}T00:00:00.000Z`);
  const fin = new Date(`${finArg}T00:00:00.000Z`);
  const items = await prisma.scheduleItem.findMany({
    where: { date: { gte: debut, lte: fin } },
    select: { date: true, status: true },
  });
  const parJour = new Map<string, { DRAFT: number; PUBLISHED: number }>();
  for (const it of items) {
    const d = jour(it.date);
    const e = parJour.get(d) ?? { DRAFT: 0, PUBLISHED: 0 };
    e[it.status as "DRAFT" | "PUBLISHED"]++;
    parJour.set(d, e);
  }
  console.log(`\nDu ${debutArg} au ${finArg} (brouillon / publié) :`);
  for (let d = new Date(debut); d <= fin; d = new Date(d.getTime() + 86_400_000)) {
    const k = jour(d);
    const e = parJour.get(k) ?? { DRAFT: 0, PUBLISHED: 0 };
    const vide = e.DRAFT === 0 && e.PUBLISHED === 0 ? "   (rien)" : "";
    console.log(`  ${k}   ${String(e.DRAFT).padStart(4)} / ${String(e.PUBLISHED).padStart(4)}${vide}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
