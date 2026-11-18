// ─────────────────────────────────────────────────────────────────────────────
//  Retire définitivement une personne : ses créneaux (brouillon ET publiés),
//  ses congés, ses réclamations, ses disponibilités, puis son compte.
//
//  Son prénom est ajouté à la liste « personnes_exclues » : les imports de
//  planning l'ignoreront ensuite, au lieu de recréer le compte à chaque fois
//  que son nom apparaît dans un fichier Excel.
//
//    DRY_RUN=1 npx tsx scripts/retirer-personne.ts Lionel Clémence Lise
//    npx tsx scripts/retirer-personne.ts Lionel Clémence Lise
//
//  ⚠ Faire une sauvegarde avant (scripts/dump-db.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import { SETTINGS, getExcludedNames, setExcludedNames } from "@/lib/settings";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

async function main() {
  const prenoms = process.argv.slice(2);
  if (prenoms.length === 0) {
    throw new Error("usage : retirer-personne.ts <prénom> [prénom…]");
  }

  const users = await prisma.user.findMany({ include: { worker: true } });
  const exclus = new Set((await getExcludedNames()).map(norm));

  for (const prenom of prenoms) {
    const user = users.find((u) => norm(u.prenom) === norm(prenom));
    exclus.add(norm(prenom));

    if (!user) {
      console.log(`  « ${prenom} » : aucun compte (ajouté à la liste d'exclusion)`);
      continue;
    }

    const creneaux = user.worker
      ? await prisma.scheduleItem.count({ where: { workerId: user.worker.id } })
      : 0;
    console.log(
      `  « ${prenom} » : ${creneaux} créneau(x) + le compte seront supprimés${DRY ? "  [SIMULATION]" : ""}`,
    );
    if (DRY) continue;

    // Les créneaux d'abord : la suppression du compte les laisserait en base
    // sans propriétaire (relation SetNull), invisibles et bloquant la publication.
    if (user.worker) {
      await prisma.scheduleItem.deleteMany({ where: { workerId: user.worker.id } });
    }
    await prisma.user.delete({ where: { id: user.id } }); // cascade worker, dispos, congés…
  }

  const liste = [...exclus].sort();
  if (!DRY) await setExcludedNames(liste);
  console.log(
    `\nListe « ${SETTINGS.PERSONNES_EXCLUES} » : ${liste.join(", ")}` +
      (DRY ? "   [non enregistrée, simulation]" : ""),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
