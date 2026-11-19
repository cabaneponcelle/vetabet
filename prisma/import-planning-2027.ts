// ─────────────────────────────────────────────────────────────────────────────
//  Import du planning de JANVIER 2027 (fichier « Planning individuel … .ods »).
//
//  Le fichier source code l'activité par la COULEUR de fond des cellules ; la
//  conversion en JSON (prisma/planning-2027-data.json) a déjà été faite.
//  Ici on crée les créneaux en BROUILLON, SANS SALLE (le fichier n'en indique
//  aucune). Le script est idempotent : il remplace les créneaux brouillon de la
//  période avant de les recréer.
//
//  Le fichier de données n'est PAS versionné (dépôt public, planning nominatif) :
//  il est lu au lancement, pas importé à la compilation.
//
//    npx tsx prisma/import-planning-2027.ts [fichier.json]   → import réel
//    DRY_RUN=1 npx tsx prisma/import-planning-2027.ts        → simulation
//    DATABASE_URL=… npx tsx prisma/import-planning-2027.ts   → autre base
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getExcludedNames } from "@/lib/settings";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1";

const MOT_DE_PASSE_DEFAUT = "veto1234";
const FICHIER_DEFAUT = "prisma/planning-2027-data.json";

interface Item {
  worker: string;
  date: string; // "AAAA-MM-JJ"
  heureDebut: string;
  heureFin: string;
  activity: string;
}

interface Donnees {
  source: string;
  semaine1: string;
  nouvellesActivites: Record<string, string>;
  items: Item[];
}

const ARGV = process.argv.slice(2);

// Reprend aussi les créneaux d'un import précédent qu'un script a retouchés
// depuis (remappage d'activités, correction d'alignement). À n'utiliser que
// lorsque le fichier source fait autorité sur toute la période.
const REMPLACER_IMPORTS = ARGV.includes("--remplacer-imports");

// --fenetre <début> <fin> : limite la période où l'on remplace l'existant.
// Utile quand le fichier déborde d'un jour sur une période déjà importée
// depuis une autre source — une garde du dimanche soir se terminant le lundi
// matin suffit à faire croire que la semaine suivante est à refaire.
const I_FENETRE = ARGV.indexOf("--fenetre");
const FENETRE = I_FENETRE >= 0 ? ARGV.slice(I_FENETRE + 1, I_FENETRE + 3) : [];

function lireDonnees(): Donnees {
  const positionnels = ARGV.filter(
    (a, k) => !a.startsWith("--") && !(I_FENETRE >= 0 && (k === I_FENETRE + 1 || k === I_FENETRE + 2)),
  );
  const chemin = positionnels[0] ?? FICHIER_DEFAUT;
  try {
    return JSON.parse(readFileSync(chemin, "utf-8")) as Donnees;
  } catch {
    throw new Error(
      `Fichier de données introuvable ou illisible : ${chemin}\n` +
        `Il n'est pas versionné (le dépôt est public et le planning est nominatif).\n` +
        `Régénérez-le depuis le fichier source, ou passez son chemin en argument.`,
    );
  }
}

// Comparaison de noms insensible à la casse, aux accents et aux espaces.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slug(s: string): string {
  return norm(s).replace(/ /g, ".");
}

function categorieDe(nom: string): string {
  if (/chir/i.test(nom)) return "Chirurgie";
  return "Autres";
}

async function main() {
  const data = lireDonnees();

  // Personnes retirées de la clinique : leur nom reste dans les fichiers Excel
  // envoyés par la clinique, mais on ne doit ni recréer leur compte ni remettre
  // leurs créneaux au planning (voir scripts/retirer-personne.ts).
  const exclus = new Set((await getExcludedNames()).map(norm));
  const items = data.items.filter((i) => !exclus.has(norm(i.worker)));
  const ignores = data.items.length - items.length;
  if (ignores) {
    console.log(`  ${ignores} créneau(x) ignorés : ${[...exclus].join(", ")} (personnes retirées)`);
  }
  if (items.length === 0) throw new Error("Aucun créneau à importer après exclusions.");
  const nouvelles = data.nouvellesActivites ?? {};
  const dates = items.map((i) => i.date).sort();
  const debut = new Date(`${dates[0]}T00:00:00.000Z`);
  const fin = new Date(`${dates[dates.length - 1]}T00:00:00.000Z`);

  console.log(
    `Source : ${data.source}\n` +
      `${items.length} créneaux du ${dates[0]} au ${dates[dates.length - 1]}` +
      (DRY ? "   [SIMULATION]" : ""),
  );

  // ── Activités ──────────────────────────────────────────────────────────────
  const activities = await prisma.activity.findMany();
  const actByName = new Map(activities.map((a) => [norm(a.nom), a]));

  for (const [nom, couleur] of Object.entries(nouvelles)) {
    if (actByName.has(norm(nom))) continue;
    console.log(`  + activité « ${nom} » (${couleur})`);
    if (!DRY) {
      const a = await prisma.activity.create({
        data: { nom, categorie: categorieDe(nom), couleur },
      });
      actByName.set(norm(a.nom), a);
    } else {
      actByName.set(norm(nom), { id: "dry", nom, categorie: null, couleur } as never);
    }
  }

  const activitesManquantes = [...new Set(items.map((i) => i.activity))].filter(
    (a) => !actByName.has(norm(a)),
  );
  if (activitesManquantes.length) {
    throw new Error(`Activités introuvables : ${activitesManquantes.join(", ")}`);
  }

  // ── Travailleurs ───────────────────────────────────────────────────────────
  const workers = await prisma.worker.findMany({ include: { user: true } });
  const workerByName = new Map(workers.map((w) => [norm(w.user.prenom), w]));

  for (const prenom of [...new Set(items.map((i) => i.worker))]) {
    if (workerByName.has(norm(prenom))) continue;
    console.log(`  + compte « ${prenom} » (mot de passe par défaut : à réinitialiser)`);
    if (!DRY) {
      const user = await prisma.user.create({
        data: {
          prenom,
          nom: "",
          email: `${slug(prenom)}@vetabet.local`,
          passwordHash: await bcrypt.hash(MOT_DE_PASSE_DEFAUT, 10),
          role: "WORKER",
          actif: true,
        },
      });
      const worker = await prisma.worker.create({
        data: { userId: user.id, fonction: "Vétérinaire", actif: true },
      });
      workerByName.set(norm(prenom), { ...worker, user } as never);
    } else {
      workerByName.set(norm(prenom), { id: "dry" } as never);
    }
  }

  // ── Remplacement des créneaux brouillon de la période ──────────────────────
  //  On ne remplace que ce qu'un import précédent avait posé et que personne
  //  n'a retouché depuis : tout ce que la RH a ajouté ou corrigé à la main dans
  //  l'application est conservé, et l'import ne repose pas un doublon par-dessus
  //  (même personne, même jour, mêmes heures).
  const fenetreDebut = FENETRE[0] ? new Date(`${FENETRE[0]}T00:00:00.000Z`) : debut;
  const fenetreFin = FENETRE[1] ? new Date(`${FENETRE[1]}T00:00:00.000Z`) : fin;
  const dansFenetre = (d: Date) => d >= fenetreDebut && d <= fenetreFin;

  const existants = await prisma.scheduleItem.findMany({
    where: {
      status: "DRAFT",
      date: {
        gte: debut < fenetreDebut ? debut : fenetreDebut,
        lte: fin > fenetreFin ? fin : fenetreFin,
      },
    },
    select: {
      id: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      workerId: true,
      date: true,
      heureDebut: true,
      heureFin: true,
    },
  });

  const MARGE_MS = 2_000; // écart toléré entre création et dernière écriture
  const remplacables = existants.filter(
    (e) =>
      dansFenetre(e.date) &&
      e.createdBy?.startsWith("import-") &&
      (REMPLACER_IMPORTS || e.updatedAt.getTime() - e.createdAt.getTime() < MARGE_MS),
  );
  const aGarder = existants.filter((e) => !remplacables.includes(e));
  const cle = (w: string | null, d: Date, h1: string, h2: string) =>
    `${w}|${d.toISOString().slice(0, 10)}|${h1}|${h2}`;
  const dejaLa = new Set(aGarder.map((e) => cle(e.workerId, e.date, e.heureDebut, e.heureFin)));

  console.log(
    `  ${existants.length} créneau(x) brouillon sur la période ` +
      `(remplacement du ${fenetreDebut.toISOString().slice(0, 10)} au ` +
      `${fenetreFin.toISOString().slice(0, 10)}) : ${remplacables.length} remplacés, ` +
      `${aGarder.length} conservés (hors fenêtre, saisis ou corrigés dans l'application)`,
  );

  if (DRY) {
    console.log(`  ${items.length} créneaux seraient créés (brouillon, sans salle).`);
    return;
  }

  await prisma.scheduleItem.deleteMany({ where: { id: { in: remplacables.map((e) => e.id) } } });

  const rows = items
    .map((i) => ({
      titre: null,
      description: null,
      date: new Date(`${i.date}T00:00:00.000Z`),
      heureDebut: i.heureDebut,
      heureFin: i.heureFin,
      status: "DRAFT" as const,
      workerId: workerByName.get(norm(i.worker))!.id,
      roomId: null, // le fichier source n'indique pas de salle
      activityId: actByName.get(norm(i.activity))!.id,
      createdBy: "import-2027",
    }))
    .filter((r) => !dejaLa.has(cle(r.workerId, r.date, r.heureDebut, r.heureFin)));

  const res = await prisma.scheduleItem.createMany({ data: rows });
  console.log(
    `✅ ${res.count} créneaux créés en brouillon, sans salle` +
      (items.length - rows.length > 0
        ? ` (${items.length - rows.length} déjà présents à la main, non dupliqués).`
        : "."),
  );

  const total = await prisma.scheduleItem.count({ where: { status: "DRAFT" } });
  console.log(`   Total brouillon dans la base : ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
