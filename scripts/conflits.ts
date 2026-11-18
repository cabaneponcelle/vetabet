// Liste les conflits du brouillon, bloquants d'abord. Même moteur que la page
// « Incohérences » de l'application : sert à comprendre un refus de publication.
//
//   npx tsx scripts/conflits.ts [nombre d'exemples par type]
import { loadConflicts } from "@/lib/schedule";

async function main() {
  const max = Number(process.argv[2] ?? 6);
  const conflits = await loadConflicts();

  const bloquants = conflits.filter((c) => c.severite === "BLOQUANT");
  const avertissements = conflits.filter((c) => c.severite !== "BLOQUANT");
  console.log(`${bloquants.length} bloquant(s), ${avertissements.length} avertissement(s)`);

  for (const groupe of [bloquants, avertissements]) {
    const parType = new Map<string, typeof groupe>();
    for (const c of groupe) {
      const l = parType.get(c.type) ?? [];
      l.push(c);
      parType.set(c.type, l);
    }
    for (const [type, liste] of parType) {
      console.log(`\n${type} — ${liste.length}`);
      for (const c of liste.slice(0, max)) {
        console.log(`   ${c.date} ${c.heure ?? ""} ${c.message}${c.ignored ? "  [ignoré]" : ""}`);
      }
      if (liste.length > max) console.log(`   … et ${liste.length - max} autres`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
