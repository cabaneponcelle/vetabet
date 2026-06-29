import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { loadItems, serializeItem } from "@/lib/schedule";
import { scheduleItemSchema } from "@/lib/validation";
import type { ItemStatus } from "@prisma/client";

const itemInclude = {
  worker: { include: { user: true } },
  room: true,
  activity: true,
} as const;

// GET /api/schedule-items — liste filtrée des créneaux (RH).
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const sp = req.nextUrl.searchParams;
  const status = (sp.get("status") as ItemStatus | null) ?? "DRAFT";
  const items = await loadItems({
    status,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    workerId: sp.get("workerId") ?? undefined,
    roomId: sp.get("roomId") ?? undefined,
  });
  return NextResponse.json(items);
}

// POST /api/schedule-items — création d'un créneau (RH).
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = scheduleItemSchema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());

  const d = parsed.data;
  const created = await prisma.scheduleItem.create({
    data: {
      titre: d.titre ?? null,
      description: d.description ?? null,
      date: new Date(`${d.date}T00:00:00.000Z`),
      heureDebut: d.heureDebut,
      heureFin: d.heureFin,
      status: "DRAFT",
      workerId: d.workerId || null,
      roomId: d.roomId || null,
      activityId: d.activityId || null,
      createdBy: guard.session!.user.id,
    },
    include: itemInclude,
  });
  return NextResponse.json(serializeItem(created), { status: 201 });
}
