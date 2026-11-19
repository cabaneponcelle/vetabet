// ─────────────────────────────────────────────────────────────────────────────
//  Ajoute l'index (status, date) sur ScheduleItem : les écrans n'affichent
//  qu'une période à la fois, et sans cet index chaque semaine demandée fait
//  parcourir tout le planning.
//
//  Purement additif, idempotent.
//
//    npx tsx scripts/migration-index-planning.ts
//    DATABASE_URL=… npx tsx scripts/migration-index-planning.ts   (prod)
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ScheduleItem_status_date_idx" ON "ScheduleItem"("status", "date")`,
  );
  const index = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'ScheduleItem' AND indexname = 'ScheduleItem_status_date_idx'`,
  );
  console.log(index.length ? "Index (status, date) en place." : "⚠ index absent après création.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
