// Liste les activités avec leur couleur et le nombre de créneaux qui s'en
// servent. Utile avant un import : repérer les doublons et les activités
// « À préciser » qui restent à nommer.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const activites = await prisma.activity.findMany({ orderBy: { nom: "asc" } });
  const compte = await prisma.scheduleItem.groupBy({
    by: ["activityId"],
    _count: { _all: true },
  });
  const parId = new Map(compte.map((c) => [c.activityId, c._count._all]));

  console.log(`${activites.length} activités :`);
  for (const a of activites) {
    console.log(
      `  ${(a.couleur ?? "—").padEnd(8)} ${a.nom.padEnd(32)} ${String(parId.get(a.id) ?? 0).padStart(5)} créneaux`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
