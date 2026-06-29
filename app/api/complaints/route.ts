import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, badRequest } from "@/lib/api";
import { complaintSchema } from "@/lib/validation";
import { sendMail } from "@/lib/mail";
import { getSetting } from "@/lib/settings";
import { dateStr } from "@/lib/schedule";

const TYPE_LABELS: Record<string, string> = {
  INDISPO: "Je ne suis pas disponible",
  MAUVAISE_SALLE: "Mauvaise salle",
  HORAIRE: "Horaire incorrect",
  CONFLIT: "Conflit avec un autre créneau",
  AUTRE: "Autre problème",
};

const complaintInclude = {
  worker: { include: { user: true } },
  scheduleItem: { include: { room: true, activity: true } },
} as const;

// GET /api/complaints — RH : toutes ; travailleur : les siennes.
export async function GET() {
  const guard = await requireSession();
  if (guard.error) return guard.error;
  const user = guard.session!.user;

  const where =
    user.role === "ADMIN" ? {} : { workerId: user.workerId ?? "__none__" };

  const complaints = await prisma.complaint.findMany({
    where,
    include: complaintInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    complaints.map((c) => ({
      id: c.id,
      type: c.type,
      typeLabel: TYPE_LABELS[c.type],
      commentaire: c.commentaire,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      workerNom: `${c.worker.user.prenom} ${c.worker.user.nom}`.trim(),
      scheduleItem: c.scheduleItem
        ? {
            id: c.scheduleItem.id,
            titre: c.scheduleItem.titre,
            date: dateStr(c.scheduleItem.date),
            heureDebut: c.scheduleItem.heureDebut,
            heureFin: c.scheduleItem.heureFin,
            roomNom: c.scheduleItem.room?.nom ?? null,
          }
        : null,
    })),
  );
}

// POST /api/complaints — un travailleur dépose une réclamation -> email RH.
export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (guard.error) return guard.error;
  const user = guard.session!.user;

  if (!user.workerId) {
    return badRequest("Seuls les travailleurs peuvent déposer une réclamation.");
  }

  const body = await req.json().catch(() => null);
  const parsed = complaintSchema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  const complaint = await prisma.complaint.create({
    data: {
      workerId: user.workerId,
      scheduleItemId: d.scheduleItemId || null,
      type: d.type,
      commentaire: d.commentaire ?? null,
      status: "NOUVELLE",
    },
    include: complaintInclude,
  });

  // Email automatique à la RH (simulé en dev si SMTP non configuré).
  const emailRh = await getSetting("email_rh", "admin@assistovet.local");
  const item = complaint.scheduleItem;
  const ctx = item
    ? `Créneau : ${dateStr(item.date)} ${item.heureDebut}-${item.heureFin}${item.titre ? ` (${item.titre})` : ""}`
    : "Aucun créneau spécifique";
  await sendMail({
    to: emailRh,
    subject: `Nouvelle réclamation — ${TYPE_LABELS[d.type]}`,
    text:
      `${complaint.worker.user.prenom} ${complaint.worker.user.nom} a déposé une réclamation.\n\n` +
      `Type : ${TYPE_LABELS[d.type]}\n${ctx}\n\nCommentaire : ${d.commentaire ?? "(aucun)"}`,
  }).catch((e) => console.error("Echec envoi email réclamation:", e));

  return NextResponse.json({ id: complaint.id, ok: true }, { status: 201 });
}
