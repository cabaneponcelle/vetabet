// Publie le planning (brouillon -> copies publiées) en ligne de commande, en
// réutilisant exactement la logique du bouton « Publier » de l'application
// (lib/publish.ts) : écriture groupée, refus si un conflit BLOQUANT subsiste.
//
//   npx tsx scripts/publish.ts
//   DATABASE_URL=… npx tsx scripts/publish.ts   (autre base)
import { publishPlanning } from "../lib/publish";

async function main() {
  const t0 = Date.now();
  const res = await publishPlanning();
  const secondes = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res.ok) {
    console.error(`Publication refusée : ${res.blocking} conflit(s) bloquant(s) à corriger.`);
    process.exit(1);
  }
  console.log(
    `✅ Planning publié en ${secondes} s — ${res.published} créneaux visibles par l'équipe ` +
      `(${res.crees} ajoutés, ${res.modifies} mis à jour, ${res.supprimes} retirés).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
