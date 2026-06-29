import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { leaveDecisionSchema } from "@/lib/validation";

const DAY = 86_400_000;

async function congeActivityId(): Promise<string> {
  const existing = await prisma.activity.findFirst({ where: { nom: "Congé" } });
  if (existing) return existing.id;
  const created = await prisma.activity.create({
    data: { nom: "Congé", categorie: "Congés", couleur: "#BFBFBF" },
  });
  return created.id;
}

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

  const startMs = leave.dateDebut.getTime();
  const endMs = leave.dateFin.getTime();

  // Nettoie d'éventuels créneaux Congé déjà créés pour ce véto sur la période.
  const congeId = await congeActivityId();
  await prisma.scheduleItem.deleteMany({
    where: {
      workerId: leave.workerId,
      activityId: congeId,
      date: { gte: new Date(startMs), lte: new Date(endMs) },
    },
  });

  let crees = 0;
  if (parsed.data.status === "APPROUVE") {
    for (let ms = startMs; ms <= endMs; ms += DAY) {
      await prisma.scheduleItem.create({
        data: {
          titre: "Congé",
          date: new Date(ms),
          heureDebut: "07:00",
          heureFin: "23:00",
          status: "DRAFT",
          workerId: leave.workerId,
          activityId: congeId,
          createdBy: "leave",
        },
      });
      crees++;
    }
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: parsed.data.status, decidedBy: guard.session!.user.id },
  });

  return NextResponse.json({ ok: true, status: parsed.data.status, creneauxConge: crees });
}
