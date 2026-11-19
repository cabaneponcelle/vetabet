import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { loadTemplateSlots, creneauxDepuisTemplate } from "@/lib/templates";
import { getAncreRoulement, lundiDe, rangRoulement } from "@/lib/roulement";

const schema = z.object({
  // Une année de roulement d'un coup reste raisonnable ; au-delà, mieux vaut
  // s'y reprendre en deux fois que lancer une écriture interminable.
  lundis: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1, "Choisissez au moins une semaine.")
    .max(53, "Trop de semaines d'un coup : 53 au maximum (un an)."),
  workerId: z.string().min(1).optional(), // absent = toute l'équipe
  remplacer: z.boolean().optional(), // vider les semaines cibles d'abord
  // Force une semaine type précise au lieu de suivre le roulement : utile pour
  // poser un S2 sur une semaine qui serait un S3 (remplacement, échange…).
  semaine: z.number().int().min(1).max(4).optional(),
});

// POST /api/semaines-types/appliquer — projette les semaines types sur de
// vraies semaines du planning (en brouillon). Le rang du roulement de chaque
// semaine est déduit du calendrier de la clinique.
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // « Données invalides » tout court ne dit pas quoi corriger : on remonte le
    // premier motif, qui est celui que la RH peut traiter.
    const motif = parsed.error.issues[0]?.message;
    return badRequest(motif || "Données invalides", parsed.error.flatten());
  }
  const { workerId, remplacer, semaine: semaineImposee } = parsed.data;

  const [slots, ancre] = await Promise.all([loadTemplateSlots(workerId), getAncreRoulement()]);
  if (slots.length === 0) {
    return badRequest("Aucune semaine type enregistrée pour cette sélection.");
  }
  if (semaineImposee && !slots.some((s) => s.semaine === semaineImposee)) {
    return badRequest(`La semaine type S${semaineImposee} est vide pour cette sélection.`);
  }

  const lundis = [...new Set(parsed.data.lundis.map(lundiDe))].sort();
  let crees = 0;
  let retires = 0;
  const detail: { lundi: string; rang: number; crees: number }[] = [];

  for (const lundi of lundis) {
    const rang = semaineImposee ?? rangRoulement(lundi, ancre);
    const [y, m, d] = lundi.split("-").map(Number);
    const debut = new Date(Date.UTC(y, m - 1, d));
    const fin = new Date(Date.UTC(y, m - 1, d) + 6 * 86_400_000);

    if (remplacer) {
      const res = await prisma.scheduleItem.deleteMany({
        where: {
          status: "DRAFT",
          date: { gte: debut, lte: fin },
          ...(workerId ? { workerId } : {}),
        },
      });
      retires += res.count;
    }

    const rows = creneauxDepuisTemplate(slots, lundi, rang, "semaine-type");
    if (rows.length) {
      const res = await prisma.scheduleItem.createMany({ data: rows });
      crees += res.count;
      detail.push({ lundi, rang, crees: res.count });
    } else {
      detail.push({ lundi, rang, crees: 0 });
    }
  }

  return NextResponse.json({ ok: true, crees, retires, detail });
}
