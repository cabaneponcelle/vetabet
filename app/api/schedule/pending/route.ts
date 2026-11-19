import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/api";
import { getSetting } from "@/lib/settings";

// GET /api/schedule/pending — y a-t-il des modifications non publiées ?
//
// L'écran de planning ne charge que la période affichée : il ne peut plus
// déduire ce drapeau des créneaux qu'il a sous la main. Un simple compte en
// base, lui, couvre tout le planning sans rien transférer.
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const derniere = await getSetting("derniere_publication", "");
  const aPublier = await prisma.scheduleItem.count({
    where: {
      status: "DRAFT",
      ...(derniere ? { updatedAt: { gt: new Date(derniere) } } : {}),
    },
  });

  return NextResponse.json({ derniere_publication: derniere || null, aPublier });
}
