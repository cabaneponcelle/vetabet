// ─────────────────────────────────────────────────────────────────────────────
//  Crée la table TemplateSlot (semaines types S1 à S4 de chaque vétérinaire).
//
//  Purement additif : une table neuve, rien n'est réécrit ni supprimé.
//  Idempotent (IF NOT EXISTS), à lancer une fois par base.
//
//    npx tsx scripts/migration-semaines-types.ts
//    DATABASE_URL=… npx tsx scripts/migration-semaines-types.ts   (prod)
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SQL = [
  `CREATE TABLE IF NOT EXISTS "TemplateSlot" (
     "id"         TEXT PRIMARY KEY,
     "workerId"   TEXT NOT NULL,
     "semaine"    INTEGER NOT NULL,
     "jour"       INTEGER NOT NULL,
     "heureDebut" TEXT NOT NULL,
     "heureFin"   TEXT NOT NULL,
     "activityId" TEXT,
     "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "TemplateSlot_workerId_fkey" FOREIGN KEY ("workerId")
       REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "TemplateSlot_activityId_fkey" FOREIGN KEY ("activityId")
       REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS "TemplateSlot_workerId_semaine_idx"
     ON "TemplateSlot"("workerId", "semaine")`,
];

async function main() {
  for (const requete of SQL) await prisma.$executeRawUnsafe(requete);

  const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'TemplateSlot'`,
  );
  console.log(Number(n) ? "Table « TemplateSlot » en place." : "⚠ table absente après création.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
