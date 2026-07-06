import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, badRequest } from "@/lib/api";
import { dateStr } from "@/lib/schedule";
import { overlaps } from "@/lib/conflicts";
import { sendMail } from "@/lib/mail";
import { getSetting } from "@/lib/settings";
import { dateFr } from "@/lib/utils";

// POST /api/gardes/:id/take — le vétérinaire connecté reprend la garde d'un
// collègue en congé. Met à jour le brouillon ET la copie publiée (visible
// immédiatement par toute l'équipe), puis prévient la RH par email.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard.error) return guard.error;
  const user = guard.session!.user;
  if (!user.workerId) return badRequest("Seuls les vétérinaires peuvent reprendre une garde.");
  const { id } = await ctx.params;

  const item = await prisma.scheduleItem.findUnique({
    where: { id },
    include: { worker: { include: { user: true } }, activity: true, room: true },
  });
  if (!item || item.status !== "DRAFT" || !item.workerId) {
    return NextResponse.json({ error: "Garde introuvable." }, { status: 404 });
  }
  if (item.workerId === user.workerId) return badRequest("Ce créneau est déjà le vôtre.");

  const d = dateStr(item.date);
  const today = new Date().toISOString().slice(0, 10);
  if (d < today) return badRequest("Cette garde est déjà passée.");

  // Le titulaire est-il bien en congé approuvé ce jour-là ?
  const titulaireEnConge = await prisma.leaveRequest.findFirst({
    where: {
      workerId: item.workerId,
      status: "APPROUVE",
      dateDebut: { lte: new Date(`${d}T00:00:00.000Z`) },
      dateFin: { gte: new Date(`${d}T00:00:00.000Z`) },
    },
  });
  if (!titulaireEnConge) {
    return badRequest("Cette garde n'est plus à reprendre (le titulaire n'est pas en congé).");
  }

  // Le repreneur est-il lui-même en congé ce jour-là ?
  const preneurEnConge = await prisma.leaveRequest.findFirst({
    where: {
      workerId: user.workerId,
      status: "APPROUVE",
      dateDebut: { lte: new Date(`${d}T00:00:00.000Z`) },
      dateFin: { gte: new Date(`${d}T00:00:00.000Z`) },
    },
  });
  if (preneurEnConge) return badRequest("Vous êtes en congé ce jour-là.");

  // Chevauchement avec les créneaux existants du repreneur ?
  const mesItems = await prisma.scheduleItem.findMany({
    where: { status: "DRAFT", workerId: user.workerId, date: item.date },
  });
  const clash = mesItems.find((m) => overlaps(item.heureDebut, item.heureFin, m.heureDebut, m.heureFin));
  if (clash) {
    return badRequest(
      `Impossible : vous avez déjà un créneau de ${clash.heureDebut} à ${clash.heureFin} ce jour-là.`,
    );
  }

  const ancienNom = `${item.worker!.user.prenom} ${item.worker!.user.nom}`.trim();

  // Réassignation : brouillon + copie publiée (via sourceId) en une transaction.
  await prisma.$transaction([
    prisma.scheduleItem.update({ where: { id }, data: { workerId: user.workerId } }),
    prisma.scheduleItem.updateMany({
      where: { sourceId: id, status: "PUBLISHED" },
      data: { workerId: user.workerId },
    }),
  ]);

  // Email automatique à la RH.
  const emailRh = await getSetting("email_rh", "admin@vetabet.local");
  const quoi = item.activity?.nom ?? item.titre ?? "créneau";
  await sendMail({
    to: emailRh,
    subject: `Garde reprise — ${dateFr(d)}`,
    text:
      `${user.name} a repris la garde de ${ancienNom}.\n\n` +
      `Date : ${dateFr(d)}\nHoraire : ${item.heureDebut}–${item.heureFin}\n` +
      `Activité : ${quoi}${item.room ? `\nSalle : ${item.room.nom}` : ""}\n\n` +
      `Le planning (brouillon et publié) a été mis à jour automatiquement.`,
  }).catch((e) => console.error("Echec email reprise de garde:", e));

  return NextResponse.json({ ok: true, message: `Garde du ${dateFr(d)} reprise.` });
}
