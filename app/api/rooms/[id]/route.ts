import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { roomSchema } from "@/lib/validation";

// PATCH /api/rooms/:id — modification d'une salle (RH).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = roomSchema.partial().safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  const room = await prisma.room
    .update({
      where: { id },
      data: {
        ...(d.nom !== undefined ? { nom: d.nom } : {}),
        ...(d.type !== undefined ? { type: d.type ?? null } : {}),
        ...(d.description !== undefined ? { description: d.description ?? null } : {}),
        ...(d.couleur !== undefined ? { couleur: d.couleur } : {}),
        ...(d.actif !== undefined ? { actif: d.actif } : {}),
      },
    })
    .catch(() => null);
  if (!room) return NextResponse.json({ error: "Salle introuvable" }, { status: 404 });
  return NextResponse.json(room);
}

// DELETE /api/rooms/:id — suppression d'une salle (RH).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  await prisma.room.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
