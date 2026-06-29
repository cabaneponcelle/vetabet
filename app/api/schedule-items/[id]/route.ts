import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { serializeItem } from "@/lib/schedule";
import { scheduleItemSchema } from "@/lib/validation";

const itemInclude = {
  worker: { include: { user: true } },
  room: true,
  activity: true,
} as const;

// PATCH /api/schedule-items/:id — modification d'un créneau (RH).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = scheduleItemSchema.partial().safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  const existing = await prisma.scheduleItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });

  const updated = await prisma.scheduleItem.update({
    where: { id },
    data: {
      ...(d.titre !== undefined ? { titre: d.titre ?? null } : {}),
      ...(d.description !== undefined ? { description: d.description ?? null } : {}),
      ...(d.date ? { date: new Date(`${d.date}T00:00:00.000Z`) } : {}),
      ...(d.heureDebut ? { heureDebut: d.heureDebut } : {}),
      ...(d.heureFin ? { heureFin: d.heureFin } : {}),
      ...(d.workerId !== undefined ? { workerId: d.workerId || null } : {}),
      ...(d.roomId !== undefined ? { roomId: d.roomId || null } : {}),
      ...(d.activityId !== undefined ? { activityId: d.activityId || null } : {}),
    },
    include: itemInclude,
  });
  return NextResponse.json(serializeItem(updated));
}

// DELETE /api/schedule-items/:id — suppression d'un créneau (RH).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  await prisma.scheduleItem.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
