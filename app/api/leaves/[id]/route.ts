import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { leaveDecisionSchema } from "@/lib/validation";
import { appliquerConge } from "@/lib/leaves";

// PATCH /api/leaves/:id — la RH approuve ou refuse une demande de congé.
// À l'approbation : crée des créneaux « Congé » (07:00-23:00) sur toute la
// période, ce qui bloque la personne (tout autre créneau devient incohérent).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = leaveDecisionSchema.safeParse(body);
  if (!parsed.success) return badRequest("Statut invalide", parsed.error.flatten());

  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

  const crees = await appliquerConge(leave, parsed.data.status === "APPROUVE");

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: parsed.data.status, decidedBy: guard.session!.user.id },
  });

  return NextResponse.json({ ok: true, status: parsed.data.status, creneauxConge: crees });
}

// DELETE /api/leaves/:id — la RH supprime un congé (et retire ses créneaux).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

  await appliquerConge(leave, false); // retire les créneaux Congé posés
  await prisma.leaveRequest.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
