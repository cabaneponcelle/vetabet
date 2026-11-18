import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, badRequest } from "@/lib/api";
import { leaveSchema } from "@/lib/validation";
import { dateStr } from "@/lib/schedule";
import { appliquerConge } from "@/lib/leaves";

// GET /api/leaves — RH : toutes les demandes ; travailleur : les siennes.
export async function GET() {
  const guard = await requireSession();
  if (guard.error) return guard.error;
  const user = guard.session!.user;

  const where = user.role === "ADMIN" ? {} : { workerId: user.workerId ?? "__none__" };
  const leaves = await prisma.leaveRequest.findMany({
    where,
    include: { worker: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    leaves.map((l) => ({
      id: l.id,
      workerNom: `${l.worker.user.prenom} ${l.worker.user.nom}`.trim(),
      dateDebut: dateStr(l.dateDebut),
      dateFin: dateStr(l.dateFin),
      motif: l.motif,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    })),
  );
}

// POST /api/leaves — un travailleur dépose une demande de congé ; la RH, elle,
// encode directement le congé de quelqu'un (champ `workerId`), approuvé
// d'emblée : il apparaît aussitôt dans l'onglet « Congés » de la personne et
// pose ses créneaux dans le planning.
export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (guard.error) return guard.error;
  const user = guard.session!.user;

  const body = await req.json().catch(() => null);
  const parsed = leaveSchema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  const admin = user.role === "ADMIN";
  if (!admin && d.workerId && d.workerId !== user.workerId) {
    return badRequest("Vous ne pouvez déposer une demande que pour vous-même.");
  }

  const workerId = admin ? d.workerId : user.workerId;
  if (!workerId) {
    return badRequest(
      admin
        ? "Choisissez la personne concernée."
        : "Seuls les travailleurs peuvent demander un congé.",
    );
  }

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) return badRequest("Travailleur introuvable.");

  // La RH encode un congé déjà accordé, sauf demande explicite du contraire.
  const status = admin ? (d.status ?? "APPROUVE") : "EN_ATTENTE";

  const leave = await prisma.leaveRequest.create({
    data: {
      workerId,
      dateDebut: new Date(`${d.dateDebut}T00:00:00.000Z`),
      dateFin: new Date(`${d.dateFin}T00:00:00.000Z`),
      motif: d.motif ?? null,
      status,
      decidedBy: admin && status === "APPROUVE" ? user.id : null,
    },
  });

  const creneauxConge = status === "APPROUVE" ? await appliquerConge(leave, true) : 0;

  return NextResponse.json({ id: leave.id, ok: true, status, creneauxConge }, { status: 201 });
}
