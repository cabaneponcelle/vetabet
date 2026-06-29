import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { complaintStatusSchema } from "@/lib/validation";

// PATCH /api/complaints/:id — change le statut d'une réclamation (RH).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = complaintStatusSchema.safeParse(body);
  if (!parsed.success) return badRequest("Statut invalide", parsed.error.flatten());

  const updated = await prisma.complaint
    .update({ where: { id }, data: { status: parsed.data.status } })
    .catch(() => null);
  if (!updated) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true, status: updated.status });
}
