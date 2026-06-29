import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { workerSchema } from "@/lib/validation";

// PATCH /api/workers/:id — modification d'un travailleur (RH).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = workerSchema.partial().safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  const worker = await prisma.worker.findUnique({ where: { id }, include: { user: true } });
  if (!worker) return NextResponse.json({ error: "Travailleur introuvable" }, { status: 404 });

  // Vérifie l'unicité de l'email si changé.
  if (d.email && d.email.toLowerCase() !== worker.user.email) {
    const taken = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
    if (taken) return badRequest("Cet email est déjà utilisé.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: worker.userId },
      data: {
        ...(d.prenom !== undefined ? { prenom: d.prenom } : {}),
        ...(d.nom !== undefined ? { nom: d.nom } : {}),
        ...(d.email ? { email: d.email.toLowerCase().trim() } : {}),
        ...(d.actif !== undefined ? { actif: d.actif } : {}),
        ...(d.password && d.password.length >= 4
          ? { passwordHash: await bcrypt.hash(d.password, 10) }
          : {}),
      },
    });
    await tx.worker.update({
      where: { id },
      data: {
        ...(d.fonction !== undefined ? { fonction: d.fonction ?? null } : {}),
        ...(d.telephone !== undefined ? { telephone: d.telephone ?? null } : {}),
        ...(d.actif !== undefined ? { actif: d.actif } : {}),
      },
    });
    // Remplace les disponibilités si fournies.
    if (d.availabilities) {
      await tx.availability.deleteMany({ where: { workerId: id } });
      if (d.availabilities.length) {
        await tx.availability.createMany({
          data: d.availabilities.map((a) => ({ ...a, workerId: id })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/workers/:id — suppression définitive (RH). Les créneaux liés
// conservent leur place mais perdent l'affectation (workerId -> null).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker) return NextResponse.json({ error: "Travailleur introuvable" }, { status: 404 });

  // La suppression de l'utilisateur cascade sur la fiche Worker (et ses dispos).
  await prisma.user.delete({ where: { id: worker.userId } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
