// ─────────────────────────────────────────────────────────────────────────────
//  Rend un propriétaire aux créneaux orphelins (workerId à NULL après la
//  suppression d'un compte), en les recoupant avec le fichier d'import
//  d'origine : même date, mêmes heures, même activité → même personne.
//
//    npx tsx scripts/reattribuer-orphelins.ts <fichier.json> <lundi semaine 1>
//    DRY_RUN=1 … pour simuler
//
//  Le fichier peut être au format « semaine/jour » (planning-data.json) ou au
//  format daté (planning-2027-data.json).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1";

interface Item {
  worker: string;
  activity: string;
  date?: string;
  week?: number;
  day?: number;
  heureDebut: string;
  heureFin: string;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function dateDe(i: Item, lundi1: string): string {
  if (i.date) return i.date;
  const [y, m, d] = lundi1.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + ((i.week! - 1) * 7 + i.day!) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

async function main() {
  const [fichier, lundi1] = process.argv.slice(2);
  if (!fichier || !lundi1) {
    throw new Error("usage : reattribuer-orphelins.ts <fichier.json> <lundi semaine 1>");
  }

  const brut = JSON.parse(readFileSync(fichier, "utf-8"));
  const items: Item[] = Array.isArray(brut) ? brut : brut.items;

  // clé « date|début|fin|activité » → noms possibles
  const index = new Map<string, Set<string>>();
  for (const i of items) {
    const k = `${dateDe(i, lundi1)}|${i.heureDebut}|${i.heureFin}|${norm(i.activity)}`;
    (index.get(k) ?? index.set(k, new Set()).get(k)!).add(i.worker);
  }

  const workers = await prisma.worker.findMany({ include: { user: true } });
  const parNom = new Map(workers.map((w) => [norm(w.user.prenom), w]));

  const orphelins = await prisma.scheduleItem.findMany({
    where: { workerId: null },
    select: {
      id: true, date: true, heureDebut: true, heureFin: true, status: true, activityId: true,
      activity: { select: { nom: true } },
    },
  });

  let rendus = 0;
  const restants: string[] = [];
  const compte = new Map<string, number>();

  for (const o of orphelins) {
    const k = `${o.date.toISOString().slice(0, 10)}|${o.heureDebut}|${o.heureFin}|${norm(o.activity?.nom ?? "")}`;
    let noms = [...(index.get(k) ?? [])];

    // Plusieurs personnes avaient ce créneau exact : on écarte celles qui sont
    // déjà en place, l'orphelin appartient à celle qui manque.
    if (noms.length > 1) {
      const places = await prisma.scheduleItem.findMany({
        where: {
          date: o.date,
          heureDebut: o.heureDebut,
          heureFin: o.heureFin,
          status: o.status,
          activityId: o.activityId,
          NOT: { workerId: null },
        },
        select: { worker: { select: { user: { select: { prenom: true } } } } },
      });
      const occupes = new Set(places.map((p) => norm(p.worker!.user.prenom)));
      noms = noms.filter((n) => !occupes.has(norm(n)));
    }

    const worker = noms.length === 1 ? parNom.get(norm(noms[0])) : undefined;
    if (!worker) {
      restants.push(`${k} (${noms.length} candidat(s))`);
      continue;
    }
    if (!DRY) await prisma.scheduleItem.update({ where: { id: o.id }, data: { workerId: worker.id } });
    compte.set(noms[0], (compte.get(noms[0]) ?? 0) + 1);
    rendus++;
  }

  console.log(`${rendus}/${orphelins.length} créneaux réattribués${DRY ? "  [SIMULATION]" : ""}`);
  for (const [nom, n] of compte) console.log(`   ${nom} : ${n}`);
  if (restants.length) {
    console.log(`\n${restants.length} sans correspondance certaine :`);
    for (const r of restants.slice(0, 10)) console.log(`   ${r}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
