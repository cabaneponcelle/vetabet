import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { roomSchema } from "@/lib/validation";

// GET /api/rooms — liste des salles (RH).
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const q = req.nextUrl.searchParams.get("q")?.toLowerCase();
  const rooms = await prisma.room.findMany({ orderBy: { nom: "asc" } });
  const data = q
    ? rooms.filter((r) => `${r.nom} ${r.type ?? ""}`.toLowerCase().includes(q))
    : rooms;
  return NextResponse.json(data);
}

// POST /api/rooms — création d'une salle (RH).
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = roomSchema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  const room = await prisma.room.create({
    data: {
      nom: d.nom,
      type: d.type ?? null,
      description: d.description ?? null,
      couleur: d.couleur || "#3b82f6",
      actif: d.actif ?? true,
    },
  });
  return NextResponse.json(room, { status: 201 });
}
