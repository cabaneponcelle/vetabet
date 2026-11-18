import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";

const ordreSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) });

// POST /api/workers/ordre — enregistre l'ordre d'affichage des travailleurs.
// La RH envoie la liste complète des identifiants dans l'ordre voulu ; on leur
// attribue les rangs 1, 2, 3… Les fiches absentes de la liste repassent sans
// rang (affichées ensuite, par prénom).
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = ordreSchema.safeParse(body);
  if (!parsed.success) return badRequest("Liste d'identifiants invalide", parsed.error.flatten());
  const { ids } = parsed.data;

  const connus = await prisma.worker.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const valides = new Set(connus.map((w) => w.id));
  const ordonnes = ids.filter((id) => valides.has(id));
  if (ordonnes.length === 0) return badRequest("Aucun travailleur reconnu dans la liste.");

  await prisma.$transaction([
    prisma.worker.updateMany({ where: { id: { notIn: ordonnes } }, data: { ordre: null } }),
    ...ordonnes.map((id, i) =>
      prisma.worker.update({ where: { id }, data: { ordre: i + 1 } }),
    ),
  ]);

  return NextResponse.json({ ok: true, ordonnes: ordonnes.length });
}
