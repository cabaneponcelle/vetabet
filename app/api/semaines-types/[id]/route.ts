import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { templateSlotSchema } from "@/lib/validation";
import { serializeTemplateSlot } from "@/lib/templates";

// PATCH /api/semaines-types/:id — modifie un créneau de semaine type (RH).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = templateSlotSchema.partial().safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  if (d.heureDebut && d.heureFin && d.heureFin <= d.heureDebut) {
    return badRequest("L'heure de fin doit suivre l'heure de début.");
  }

  const slot = await prisma.templateSlot
    .update({
      where: { id },
      data: {
        ...(d.semaine !== undefined ? { semaine: d.semaine } : {}),
        ...(d.jour !== undefined ? { jour: d.jour } : {}),
        ...(d.heureDebut !== undefined ? { heureDebut: d.heureDebut } : {}),
        ...(d.heureFin !== undefined ? { heureFin: d.heureFin } : {}),
        ...(d.activityId !== undefined ? { activityId: d.activityId ?? null } : {}),
      },
      include: { worker: { include: { user: true } }, activity: true },
    })
    .catch(() => null);

  if (!slot) return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });
  return NextResponse.json(serializeTemplateSlot(slot));
}

// DELETE /api/semaines-types/:id — retire un créneau d'une semaine type (RH).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  await prisma.templateSlot.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
