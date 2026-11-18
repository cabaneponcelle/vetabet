// ─────────────────────────────────────────────────────────────────────────────
//  Qui se connecte encore avec le mot de passe par défaut ?
//
//  Les mots de passe sont stockés chiffrés (bcrypt) : personne, pas même la RH,
//  ne peut les relire. On peut seulement tester si un mot de passe connu
//  correspond. Ce script compare chaque compte aux valeurs par défaut.
//
//    npx tsx scripts/etat-mots-de-passe.ts
//    npx tsx scripts/etat-mots-de-passe.ts --reinitialiser  → remet le mot de
//      passe par défaut sur les comptes qui en ont un personnalisé (jamais sur
//      l'admin), pour redonner un accès connu à toute l'équipe.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAUTS = ["veto1234", "admin1234"];

async function main() {
  const reinitialiser = process.argv.includes("--reinitialiser");

  const users = await prisma.user.findMany({ orderBy: { prenom: "asc" } });
  const lignes: string[] = [];
  let personnalises = 0;

  for (const u of users) {
    let connu: string | null = null;
    for (const mdp of DEFAUTS) {
      if (await bcrypt.compare(mdp, u.passwordHash)) {
        connu = mdp;
        break;
      }
    }
    if (!connu) personnalises++;
    lignes.push(
      `  ${u.prenom.padEnd(13)} ${u.role.padEnd(6)} ${
        connu ? connu : "(personnalisé — chiffré, impossible à relire)"
      }${u.actif ? "" : "   [compte désactivé]"}`,
    );

    if (reinitialiser && !connu && u.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: await bcrypt.hash("veto1234", 10) },
      });
      lignes[lignes.length - 1] += "  → réinitialisé à veto1234";
    }
  }

  console.log(`${users.length} comptes :`);
  console.log(lignes.join("\n"));
  if (personnalises && !reinitialiser) {
    console.log(
      `\n${personnalises} compte(s) ont un mot de passe personnalisé. Il est illisible ; ` +
        `pour leur redonner un accès connu : --reinitialiser, ou la fiche du travailleur dans l'app.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
