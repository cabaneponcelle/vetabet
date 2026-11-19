// ─────────────────────────────────────────────────────────────────────────────
//  Amorce les semaines types (S1 à S4) à partir d'un cycle déjà planifié.
//
//  On lit quatre semaines consécutives du planning brouillon et on en fait le
//  modèle de roulement de chaque vétérinaire. Les congés sont écartés : ce sont
//  des absences, pas des journées de travail types.
//
//    npx tsx scripts/semaines-types-depuis-planning.ts 2026-11-02
//    npx tsx scripts/semaines-types-depuis-planning.ts 2026-11-02 --remplacer
//    DRY_RUN=1 … pour simuler
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import { getAncreRoulement, rangRoulement } from "@/lib/roulement";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1";
const JOUR_MS = 86_400_000;

async function main() {
  const premierLundi = process.argv[2];
  const remplacer = process.argv.includes("--remplacer");
  if (!premierLundi) throw new Error("usage : semaines-types-depuis-planning.ts <lundi> [--remplacer]");

  const ancre = await getAncreRoulement();
  const [y, m, d] = premierLundi.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);

  const dejaLa = await prisma.templateSlot.count();
  if (dejaLa && !remplacer) {
    console.log(`${dejaLa} créneau(x) type existent déjà — relancer avec --remplacer pour les écraser.`);
    return;
  }

  const lignes: {
    workerId: string;
    semaine: number;
    jour: number;
    heureDebut: string;
    heureFin: string;
    activityId: string | null;
  }[] = [];

  for (let n = 0; n < 4; n++) {
    const lundi = new Date(base + n * 7 * JOUR_MS);
    const dimanche = new Date(base + (n * 7 + 6) * JOUR_MS);
    const semaine = rangRoulement(lundi.toISOString().slice(0, 10), ancre);

    const items = await prisma.scheduleItem.findMany({
      where: { status: "DRAFT", date: { gte: lundi, lte: dimanche }, NOT: { workerId: null } },
      include: { activity: true },
    });

    let retenus = 0;
    for (const it of items) {
      if (it.activity?.nom === "Congé") continue; // absence, pas une journée type
      lignes.push({
        workerId: it.workerId!,
        semaine,
        jour: Math.round((it.date.getTime() - lundi.getTime()) / JOUR_MS),
        heureDebut: it.heureDebut,
        heureFin: it.heureFin,
        activityId: it.activityId,
      });
      retenus++;
    }
    console.log(
      `  semaine du ${lundi.toISOString().slice(0, 10)} -> S${semaine} : ${retenus} créneau(x) retenus`,
    );
  }

  if (DRY) {
    console.log(`${lignes.length} créneaux type seraient enregistrés.   [SIMULATION]`);
    return;
  }

  if (remplacer) await prisma.templateSlot.deleteMany({});
  const res = await prisma.templateSlot.createMany({ data: lignes });

  const personnes = new Set(lignes.map((l) => l.workerId)).size;
  console.log(`✅ ${res.count} créneaux type enregistrés pour ${personnes} vétérinaires.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
