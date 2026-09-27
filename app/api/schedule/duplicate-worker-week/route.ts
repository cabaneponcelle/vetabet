import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  workerId: z.string().min(1),
  sourceMonday: z.string().regex(dateRe),
  // Semaines cibles choisies dans le calendrier (une date par semaine ; elle est
  // ramenée au lundi côté serveur).
  targetMondays: z.array(z.string().regex(dateRe)).min(1).max(26),
  replace: z.boolean().optional(), // remplacer les créneaux existants DE CETTE PERSONNE
});

const DAY = 86_400_000;
function toMs(d: string): number {
  const [y, m, j] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, j);
}
function mondayMs(d: string): number {
  const ms = toMs(d);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // 0 = lundi
  return ms - dow * DAY;
}

// POST /api/schedule/duplicate-worker-week — recopie la semaine BROUILLON d'UNE
// personne vers les semaines choisies. Contrairement à duplicate-week, les
// créneaux des autres travailleurs ne sont jamais touchés.
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const { workerId, sourceMonday, targetMondays, replace } = parsed.data;

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) return badRequest("Travailleur introuvable.");

  const srcStart = mondayMs(sourceMonday);
  const srcEnd = srcStart + 6 * DAY;

  // Semaines cibles : lundis uniques, hors semaine source.
  const cibles = [...new Set(targetMondays.map(mondayMs))]
    .filter((ms) => ms !== srcStart)
    .sort((a, b) => a - b);
  if (cibles.length === 0) {
    return badRequest("Choisissez au moins une semaine différente de la semaine source.");
  }

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
    for (const tStart of cibles) {
      const offset = tStart - srcStart;
      const tEnd = tStart + 6 * DAY;

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

  return NextResponse.json({ ok: true, created, replaced, weeks: cibles.length });
}
