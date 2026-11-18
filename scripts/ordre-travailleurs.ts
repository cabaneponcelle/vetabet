// ─────────────────────────────────────────────────────────────────────────────
//  Fixe l'ordre d'affichage des travailleurs à partir d'une liste de prénoms
//  (celui de la liste WhatsApp de la clinique, par exemple). Cet ordre est
//  celui des colonnes du planning et de toutes les listes déroulantes ; il se
//  règle aussi à la souris dans Travailleurs (flèches ↑ ↓).
//
//    npx tsx scripts/ordre-travailleurs.ts "carole, clarice, alexandra, …"
//    npx tsx scripts/ordre-travailleurs.ts            → affiche l'ordre actuel
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

async function main() {
  const liste = process.argv.slice(2).join(" ");
  const workers = await prisma.worker.findMany({
    include: { user: true },
    orderBy: [{ ordre: { sort: "asc", nulls: "last" } }, { user: { prenom: "asc" } }],
  });

  if (!liste.trim()) {
    console.log("Ordre actuel :");
    for (const w of workers) {
      console.log(`  ${String(w.ordre ?? "—").padStart(3)}  ${w.user.prenom}`);
    }
    return;
  }

  const prenoms = liste
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parNom = new Map(workers.map((w) => [norm(w.user.prenom), w]));
  const vus = new Set<string>();
  let rang = 0;
  const inconnus: string[] = [];

  for (const prenom of prenoms) {
    const w = parNom.get(norm(prenom));
    if (!w) {
      inconnus.push(prenom);
      continue;
    }
    rang++;
    vus.add(w.id);
    await prisma.worker.update({ where: { id: w.id }, data: { ordre: rang } });
  }

  // Les personnes absentes de la liste repassent sans rang : elles s'affichent
  // après les autres, par prénom, au lieu de garder une position obsolète.
  const restants = workers.filter((w) => !vus.has(w.id));
  if (restants.length) {
    await prisma.worker.updateMany({
      where: { id: { in: restants.map((w) => w.id) } },
      data: { ordre: null },
    });
  }

  console.log(`${rang} travailleur(s) ordonné(s).`);
  if (inconnus.length) console.log(`  prénoms sans compte : ${inconnus.join(", ")}`);
  if (restants.length) {
    console.log(`  absents de la liste (affichés à la fin) : ${restants.map((w) => w.user.prenom).join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
