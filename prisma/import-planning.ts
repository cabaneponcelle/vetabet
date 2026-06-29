// Importe le planning réel (prisma/planning-data.json extrait de l'Excel) dans
// la table ScheduleItem (statut BROUILLON). Mappe :
//   semaine 1..4  -> semaines calendaires à partir du lundi 29/06/2026
//   véto (prénom) -> workerId
//   activité      -> activityId
// Idempotent : efface les créneaux BROUILLON existants puis réimporte.
//
// Lancement : npx tsx prisma/import-planning.ts
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

interface Block {
  worker: string;
  activity: string;
  week: number;
  day: number;
  heureDebut: string;
  heureFin: string;
}

// Lundi de la semaine 1.
const BASE_MONDAY = Date.UTC(2026, 5, 29); // 29/06/2026
const DAY_MS = 86_400_000;

function dateFor(week: number, day: number): Date {
  return new Date(BASE_MONDAY + ((week - 1) * 7 + day) * DAY_MS);
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

async function main() {
  const raw = fs.readFileSync(path.join(__dirname, "planning-data.json"), "utf-8");
  const blocks: Block[] = JSON.parse(raw);
  console.log(`📥 ${blocks.length} blocs à importer`);

  // Connexion admin par nom : prénom "admin", nom vide.
  await prisma.user.updateMany({
    where: { role: "ADMIN" },
    data: { prenom: "admin", nom: "" },
  });

  // Maps de référence.
  const workers = await prisma.worker.findMany({ include: { user: true } });
  const workerByName = new Map<string, string>();
  for (const w of workers) workerByName.set(norm(w.user.prenom), w.id);

  const activities = await prisma.activity.findMany();
  const activityByName = new Map<string, string>();
  for (const a of activities) activityByName.set(norm(a.nom), a.id);

  // Efface les créneaux brouillon existants (démo + imports précédents).
  const del = await prisma.scheduleItem.deleteMany({ where: { status: "DRAFT" } });
  console.log(`🗑️  ${del.count} créneaux brouillon supprimés`);

  let ok = 0;
  const missingWorkers = new Set<string>();
  const missingActivities = new Set<string>();
  const data: {
    titre: string;
    date: Date;
    heureDebut: string;
    heureFin: string;
    status: "DRAFT";
    workerId: string;
    activityId: string | null;
    createdBy: string;
  }[] = [];

  for (const b of blocks) {
    const workerId = workerByName.get(norm(b.worker));
    const activityId = activityByName.get(norm(b.activity)) ?? null;
    if (!workerId) {
      missingWorkers.add(b.worker);
      continue;
    }
    if (!activityId) missingActivities.add(b.activity);
    data.push({
      titre: b.activity,
      date: dateFor(b.week, b.day),
      heureDebut: b.heureDebut,
      heureFin: b.heureFin,
      status: "DRAFT",
      workerId,
      activityId,
      createdBy: "import",
    });
    ok++;
  }

  // Insertion par lots.
  const chunk = 200;
  for (let i = 0; i < data.length; i += chunk) {
    await prisma.scheduleItem.createMany({ data: data.slice(i, i + chunk) });
  }

  console.log(`✅ ${ok} créneaux importés`);
  if (missingWorkers.size) console.log("⚠️ Vétos introuvables :", [...missingWorkers]);
  if (missingActivities.size) console.log("⚠️ Activités introuvables :", [...missingActivities]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
