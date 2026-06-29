import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, badRequest } from "@/lib/api";
import { leaveSchema } from "@/lib/validation";
import { dateStr } from "@/lib/schedule";

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

// POST /api/leaves — un travailleur dépose une demande de congé.
export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (guard.error) return guard.error;
  const user = guard.session!.user;
  if (!user.workerId) return badRequest("Seuls les travailleurs peuvent demander un congé.");

  const body = await req.json().catch(() => null);
  const parsed = leaveSchema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  const leave = await prisma.leaveRequest.create({
    data: {
      workerId: user.workerId,
      dateDebut: new Date(`${d.dateDebut}T00:00:00.000Z`),
      dateFin: new Date(`${d.dateFin}T00:00:00.000Z`),
      motif: d.motif ?? null,
      status: "EN_ATTENTE",
    },
  });
  return NextResponse.json({ id: leave.id, ok: true }, { status: 201 });
}
