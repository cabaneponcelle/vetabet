// ─────────────────────────────────────────────────────────────────────────────
//  Ajoute la colonne Worker.ordre (rang d'affichage choisi par la RH).
//
//  Purement additif : une colonne nullable, rien n'est réécrit ni supprimé.
//  Idempotent (IF NOT EXISTS), à lancer une fois par base.
//
//    npx tsx scripts/migration-ordre-travailleurs.ts
//    DATABASE_URL=… npx tsx scripts/migration-ordre-travailleurs.ts   (prod)
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Worker" ADD COLUMN IF NOT EXISTS "ordre" INTEGER');

  const colonnes = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Worker' AND column_name = 'ordre'`,
  );
  console.log(colonnes.length ? "Colonne « ordre » en place." : "⚠ colonne absente après l'ajout.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
