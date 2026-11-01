// ─────────────────────────────────────────────────────────────────────────────
//  Import du planning de JANVIER 2027 (fichier « Planning individuel … .ods »).
//
//  Le fichier source code l'activité par la COULEUR de fond des cellules ; la
//  conversion en JSON (prisma/planning-2027-data.json) a déjà été faite.
//  Ici on crée les créneaux en BROUILLON, SANS SALLE (le fichier n'en indique
//  aucune). Le script est idempotent : il remplace les créneaux brouillon de la
//  période avant de les recréer.
//
//    npx tsx prisma/import-planning-2027.ts             → import réel
//    DRY_RUN=1 npx tsx prisma/import-planning-2027.ts   → simulation
//    DATABASE_URL=… npx tsx prisma/import-planning-2027.ts  → autre base
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import data from "./planning-2027-data.json";

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === "1";

const MOT_DE_PASSE_DEFAUT = "veto1234";

interface Item {
  worker: string;
  date: string; // "AAAA-MM-JJ"
  heureDebut: string;
  heureFin: string;
  activity: string;
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
  const items = data.items as Item[];
  const nouvelles = data.nouvellesActivites as Record<string, string>;
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
      // Disponibilités larges, comme les comptes créés par le seed.
      await prisma.availability.createMany({
        data: Array.from({ length: 7 }, (_, j) => ({
          workerId: worker.id,
          jourSemaine: j,
          heureDebut: "07:00",
          heureFin: "23:00",
        })),
      });
      workerByName.set(norm(prenom), { ...worker, user } as never);
    } else {
      workerByName.set(norm(prenom), { id: "dry" } as never);
    }
  }

  // ── Remplacement des créneaux brouillon de la période ──────────────────────
  const existants = await prisma.scheduleItem.count({
    where: { status: "DRAFT", date: { gte: debut, lte: fin } },
  });
  console.log(`  ${existants} créneau(x) brouillon déjà présents sur la période (ils seront remplacés)`);

  if (DRY) {
    console.log(`  ${items.length} créneaux seraient créés (brouillon, sans salle).`);
    return;
  }

  await prisma.scheduleItem.deleteMany({
    where: { status: "DRAFT", date: { gte: debut, lte: fin } },
  });

  const rows = items.map((i) => ({
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
  }));

  const res = await prisma.scheduleItem.createMany({ data: rows });
  console.log(`✅ ${res.count} créneaux créés en brouillon, sans salle.`);

  const total = await prisma.scheduleItem.count({ where: { status: "DRAFT" } });
  console.log(`   Total brouillon dans la base : ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
