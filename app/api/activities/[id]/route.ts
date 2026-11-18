import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { activitySchema } from "@/lib/validation";

// PATCH /api/activities/:id — renommer une activité ou changer sa couleur (RH).
// Les créneaux déjà planifiés suivent : ils pointent sur l'activité, pas sur
// son nom.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = activitySchema.partial().safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  if (d.nom) {
    const doublon = await prisma.activity.findFirst({
      where: { nom: { equals: d.nom, mode: "insensitive" }, NOT: { id } },
    });
    if (doublon) return badRequest("Une autre activité porte déjà ce nom.");
  }

  const activity = await prisma.activity
    .update({
      where: { id },
      data: {
        ...(d.nom !== undefined ? { nom: d.nom } : {}),
        ...(d.categorie !== undefined ? { categorie: d.categorie ?? null } : {}),
        ...(d.couleur !== undefined ? { couleur: d.couleur } : {}),
      },
    })
    .catch(() => null);
  if (!activity) return NextResponse.json({ error: "Activité introuvable" }, { status: 404 });
  return NextResponse.json(activity);
}

// DELETE /api/activities/:id — suppression (RH).
// Refusée si des créneaux l'utilisent, sauf si `remplacerPar` indique vers
// quelle activité les basculer : supprimer sans rien dire viderait des
// créneaux du planning de l'équipe.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { id } = await ctx.params;
  const remplacerPar = req.nextUrl.searchParams.get("remplacerPar");

  const utilises = await prisma.scheduleItem.count({ where: { activityId: id } });

  if (utilises > 0) {
    if (!remplacerPar) {
      return badRequest(
        `${utilises} créneau(x) utilisent cette activité. Choisissez par quelle activité les remplacer.`,
      );
    }
    const cible = await prisma.activity.findUnique({ where: { id: remplacerPar } });
    if (!cible || cible.id === id) return badRequest("Activité de remplacement invalide.");
    await prisma.scheduleItem.updateMany({
      where: { activityId: id },
      data: { activityId: cible.id },
    });
  }

  await prisma.activity.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true, deplaces: utilises });
}
