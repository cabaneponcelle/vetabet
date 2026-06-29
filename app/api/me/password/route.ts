import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, badRequest } from "@/lib/api";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4, "Le nouveau mot de passe doit faire au moins 4 caractères."),
});

// POST /api/me/password — l'utilisateur connecté change SON mot de passe.
export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());

  const user = await prisma.user.findUnique({ where: { id: guard.session!.user.id } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return badRequest("Mot de passe actuel incorrect.");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  return NextResponse.json({ ok: true });
}
