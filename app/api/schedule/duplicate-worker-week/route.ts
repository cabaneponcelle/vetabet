import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";

const schema = z.object({
  workerId: z.string().min(1),
  sourceMonday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().min(1).max(12), // nombre de semaines suivantes à remplir
  replace: z.boolean().optional(), // remplacer les créneaux existants DE CETTE PERSONNE
});

const DAY = 86_400_000;
function toMs(d: string): number {
  const [y, m, j] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, j);
}

// POST /api/schedule/duplicate-worker-week — duplique la semaine BROUILLON d'UNE
// personne vers les N semaines suivantes. Contrairement à duplicate-week, les
// créneaux des autres travailleurs ne sont jamais touchés.
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const { workerId, sourceMonday, count, replace } = parsed.data;

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) return badRequest("Travailleur introuvable.");

  const srcStart = toMs(sourceMonday);
  const srcEnd = srcStart + 6 * DAY;

  const sourceItems = await prisma.scheduleItem.findMany({
    where: {
      status: "DRAFT",
      workerId,
      date: { gte: new Date(srcStart), lte: new Date(srcEnd) },
    },
  });
  if (sourceItems.length === 0) {
    return badRequest("Aucun créneau brouillon pour cette personne dans la semaine affichée.");
  }

  let created = 0;
  let replaced = 0;
  await prisma.$transaction(async (tx) => {
    for (let i = 1; i <= count; i++) {
      const offset = i * 7 * DAY;
      const tStart = srcStart + offset;
      const tEnd = srcEnd + offset;

      if (replace) {
        const del = await tx.scheduleItem.deleteMany({
          where: {
            status: "DRAFT",
            workerId,
            date: { gte: new Date(tStart), lte: new Date(tEnd) },
          },
        });
        replaced += del.count;
      }

      for (const it of sourceItems) {
        await tx.scheduleItem.create({
          data: {
            titre: it.titre,
            description: it.description,
            date: new Date(it.date.getTime() + offset),
            heureDebut: it.heureDebut,
            heureFin: it.heureFin,
            status: "DRAFT",
            workerId: it.workerId,
            roomId: it.roomId,
            activityId: it.activityId,
            createdBy: "duplicate-worker",
          },
        });
        created++;
      }
    }
  });

  return NextResponse.json({ ok: true, created, replaced, weeks: count });
}
