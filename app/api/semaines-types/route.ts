import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireAdminApi, badRequest } from "@/lib/api";
import { templateSlotSchema } from "@/lib/validation";
import { loadTemplateSlots, serializeTemplateSlot } from "@/lib/templates";
import { getAncreRoulement, rangRoulement } from "@/lib/roulement";

// GET /api/semaines-types?workerId=… — les semaines types.
// La RH voit tout le monde ; un vétérinaire ne voit que les siennes.
export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (guard.error) return guard.error;
  const user = guard.session!.user;

  const demande = req.nextUrl.searchParams.get("workerId") ?? undefined;
  const workerId = user.role === "ADMIN" ? demande : (user.workerId ?? "__aucun__");

  const [slots, ancre] = await Promise.all([loadTemplateSlots(workerId), getAncreRoulement()]);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return NextResponse.json({
    slots,
    ancre,
    semaineCourante: rangRoulement(aujourdhui, ancre),
  });
}

// POST /api/semaines-types — ajoute un créneau à une semaine type (RH).
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = templateSlotSchema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  if (d.heureFin <= d.heureDebut) return badRequest("L'heure de fin doit suivre l'heure de début.");

  const slot = await prisma.templateSlot.create({
    data: {
      workerId: d.workerId,
      semaine: d.semaine,
      jour: d.jour,
      heureDebut: d.heureDebut,
      heureFin: d.heureFin,
      activityId: d.activityId ?? null,
    },
    include: { worker: { include: { user: true } }, activity: true },
  });

  return NextResponse.json(serializeTemplateSlot(slot), { status: 201 });
}
