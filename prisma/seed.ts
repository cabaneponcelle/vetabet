// ─────────────────────────────────────────────────────────────────────────────
//  Seed de la base : reprend la légende couleurs/activités et les vétérinaires
//  de l'ancien planning Excel, + un compte admin RH, des salles d'exemple, et
//  quelques créneaux de démonstration (brouillon).
//
//  Lancement : npm run db:seed
//  Idempotent : peut être relancé sans dupliquer les données de référence.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Mots de passe par défaut (À COMMUNIQUER puis à changer en production).
const ADMIN_PASSWORD = "admin1234";
const WORKER_PASSWORD = "veto1234";

// Légende couleurs -> activités (reprise de l'Excel).
const ACTIVITIES = [
  { nom: "Consultation", categorie: "Consultations", couleur: "#66FFFF" },
  { nom: "Consultation spécialisée", categorie: "Consultations", couleur: "#F4B183" },
  { nom: "Formation consult spé", categorie: "Consultations", couleur: "#FBE5D6" },
  { nom: "Urgences", categorie: "Urgences", couleur: "#FF00FF" },
  { nom: "Hospitalisation", categorie: "Hospitalisation", couleur: "#00FF00" },
  { nom: "Formation hospi", categorie: "Hospitalisation", couleur: "#E2F0D9" },
  { nom: "Chirurgie tissus mous", categorie: "Chirurgie", couleur: "#FF5050" },
  { nom: "Chirurgie spécialisée", categorie: "Chirurgie", couleur: "#CCCCFF" },
  { nom: "Formation chirurgie", categorie: "Chirurgie", couleur: "#FFA6A6" },
  { nom: "Anesthésie", categorie: "Anesthésie", couleur: "#7030A0" },
  { nom: "Formation anesthésie", categorie: "Anesthésie", couleur: "#CC99FF" },
  { nom: "Échographie", categorie: "Imagerie", couleur: "#3AA87E" },
  { nom: "Scanner", categorie: "Imagerie", couleur: "#0070C0" },
  { nom: "Formation imagerie", categorie: "Imagerie", couleur: "#87D5B7" },
  { nom: "Dentisterie", categorie: "Dentisterie", couleur: "#F88628" },
  { nom: "Back up", categorie: "Autres", couleur: "#FFCCFF" },
  { nom: "Bureau", categorie: "Autres", couleur: "#0066FF" },
  { nom: "Divers", categorie: "Autres", couleur: "#8FAADC" },
  { nom: "Congé", categorie: "Congés", couleur: "#BFBFBF" },
];

// Salles d'exemple (l'Excel n'avait pas de salles : ce sont des valeurs de départ).
const ROOMS = [
  { nom: "Salle d'opération 1", type: "Chirurgie", couleur: "#FF5050" },
  { nom: "Salle d'opération 2", type: "Chirurgie", couleur: "#CCCCFF" },
  { nom: "Consultation 1", type: "Consultation", couleur: "#66FFFF" },
  { nom: "Consultation 2", type: "Consultation", couleur: "#5AB0D6" },
  { nom: "Salle d'imagerie", type: "Imagerie", couleur: "#0070C0" },
  { nom: "Hospitalisation", type: "Hospitalisation", couleur: "#00B050" },
  { nom: "Salle de dentisterie", type: "Dentisterie", couleur: "#F88628" },
];

// Vétérinaires repris de l'Excel (hors intérimaires Int 1-4).
const WORKERS = [
  "Carole", "Clarice", "Florent", "Barbara", "Marisa", "Caroline", "Michèle",
  "Sarah", "Guillaume", "Arnaud", "Clémence", "Pauline", "Anne Sophie",
  "Clarisse", "Jil", "Mélanie", "Betty", "Linda", "Lise", "Juliette",
  "Melek", "Elisa",
];

// Transforme "Anne Sophie" -> "anne.sophie" (sans accents).
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents combinés
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

async function main() {
  console.log("🌱 Seed en cours…");

  // ── Admin RH ───────────────────────────────────────────────────────────────
  // Connexion par nom : prénom "admin", nom vide.
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: "admin@vetabet.local" },
    update: {},
    create: {
      nom: "",
      prenom: "admin",
      email: "admin@vetabet.local",
      passwordHash: adminHash,
      role: "ADMIN",
      actif: true,
    },
  });

  // ── Activités (légende) ─────────────────────────────────────────────────────
  for (const a of ACTIVITIES) {
    const ex = await prisma.activity.findFirst({ where: { nom: a.nom } });
    if (!ex) await prisma.activity.create({ data: a });
  }

  // ── Salles ──────────────────────────────────────────────────────────────────
  for (const r of ROOMS) {
    const ex = await prisma.room.findFirst({ where: { nom: r.nom } });
    if (!ex) await prisma.room.create({ data: r });
  }

  // ── Travailleurs (compte + fiche + dispo Lun-Ven 08:00-19:00) ───────────────
  const workerHash = await bcrypt.hash(WORKER_PASSWORD, 10);
  for (const prenom of WORKERS) {
    const email = `${slug(prenom)}@vetabet.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        nom: "",
        prenom,
        email,
        passwordHash: workerHash,
        role: "WORKER",
        actif: true,
      },
    });

    const worker = await prisma.worker.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, fonction: "Vétérinaire", actif: true },
    });

    // Disponibilités par défaut larges (tous les jours, 07:00-23:00) afin de ne
    // pas générer de faux « hors disponibilité » : la RH les affinera par véto.
    const existing = await prisma.availability.count({ where: { workerId: worker.id } });
    if (existing === 0) {
      await prisma.availability.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((jour) => ({
          workerId: worker.id,
          jourSemaine: jour,
          heureDebut: "07:00",
          heureFin: "23:00",
        })),
      });
    }
  }

  // ── Paramètres ──────────────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { cle: "email_rh" },
    update: {},
    create: { cle: "email_rh", valeur: "admin@vetabet.local" },
  });
  await prisma.setting.upsert({
    where: { cle: "workers_voient_planning_global" },
    update: {},
    create: { cle: "workers_voient_planning_global", valeur: "true" },
  });

  // ── Créneaux de démonstration (brouillon) ───────────────────────────────────
  const nbItems = await prisma.scheduleItem.count();
  if (nbItems === 0) {
    const act = (nom: string) => prisma.activity.findFirst({ where: { nom } });
    const room = (nom: string) => prisma.room.findFirst({ where: { nom } });
    const worker = async (prenom: string) => {
      const u = await prisma.user.findUnique({
        where: { email: `${slug(prenom)}@vetabet.local` },
        include: { worker: true },
      });
      return u?.worker ?? null;
    };

    // Semaine du lundi 29/06/2026.
    const demo = [
      { date: "2026-06-29", deb: "09:00", fin: "12:00", w: "Carole", r: "Consultation 1", a: "Consultation", t: "Consultations du matin" },
      { date: "2026-06-29", deb: "09:00", fin: "11:00", w: "Florent", r: "Salle d'opération 1", a: "Chirurgie tissus mous", t: "Castration chat" },
      { date: "2026-06-29", deb: "14:00", fin: "17:00", w: "Sarah", r: "Salle d'imagerie", a: "Échographie", t: "Échographies" },
      { date: "2026-06-30", deb: "09:00", fin: "12:00", w: "Barbara", r: "Consultation 2", a: "Consultation", t: "Consultations" },
      { date: "2026-06-30", deb: "10:00", fin: "12:00", w: "Guillaume", r: "Salle de dentisterie", a: "Dentisterie", t: "Détartrage" },
      { date: "2026-07-01", deb: "08:00", fin: "13:00", w: "Michèle", r: "Hospitalisation", a: "Hospitalisation", t: "Suivi hospi" },
    ];

    for (const d of demo) {
      const [a, r, w] = await Promise.all([act(d.a), room(d.r), worker(d.w)]);
      await prisma.scheduleItem.create({
        data: {
          titre: d.t,
          date: new Date(`${d.date}T00:00:00.000Z`),
          heureDebut: d.deb,
          heureFin: d.fin,
          status: "DRAFT",
          activityId: a?.id ?? null,
          roomId: r?.id ?? null,
          workerId: w?.id ?? null,
          createdBy: "seed",
        },
      });
    }
  }

  console.log("✅ Seed terminé.");
  console.log(`   Admin : prénom « admin » / ${ADMIN_PASSWORD}`);
  console.log(`   Vétos : prénom (ex. « Carole ») / ${WORKER_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
