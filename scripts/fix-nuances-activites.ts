// Rattache les activités « À préciser (…) » créées lors de l'import de janvier
// 2027 aux activités réelles : il s'agissait de simples nuances de couleur,
// déjà traitées comme telles dans scripts/extract_planning.py (table UNIFY).
//
//   DRY_RUN=1 npx tsx scripts/fix-nuances-activites.ts   → simulation
//   npx tsx scripts/fix-nuances-activites.ts             → application
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1";

// « nuance » -> activité officielle (même sens, teinte différente dans l'Excel)
const REMAP: Record<string, string> = {
  "À préciser (rouge)": "Chirurgie tissus mous", // #FF0000 -> #FF5050
  "À préciser (rose)": "Urgences", //                #F714E9 -> #FF00FF
  "À préciser (orange)": "Dentisterie", //           #ED7D31 -> #F88628
};

async function main() {
  for (const [source, cible] of Object.entries(REMAP)) {
    const src = await prisma.activity.findFirst({ where: { nom: source } });
    const dst = await prisma.activity.findFirst({ where: { nom: cible } });
    if (!src) {
      console.log(`  « ${source} » : déjà traitée ou absente`);
      continue;
    }
    if (!dst) {
      console.log(`  ⚠ activité cible « ${cible} » introuvable, on laisse « ${source} »`);
      continue;
    }
    const n = await prisma.scheduleItem.count({ where: { activityId: src.id } });
    console.log(`  ${n} créneaux : « ${source} » -> « ${cible} »${DRY ? "  [SIMULATION]" : ""}`);
    if (DRY) continue;
    await prisma.scheduleItem.updateMany({
      where: { activityId: src.id },
      data: { activityId: dst.id },
    });
    await prisma.activity.delete({ where: { id: src.id } });
  }
  console.log(`activités en base : ${await prisma.activity.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
