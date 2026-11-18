import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { activitySchema } from "@/lib/validation";

// GET /api/activities — liste des activités avec leur nombre de créneaux (RH).
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const [activities, compte] = await Promise.all([
    prisma.activity.findMany({ orderBy: { nom: "asc" } }),
    prisma.scheduleItem.groupBy({ by: ["activityId"], _count: { _all: true } }),
  ]);
  const parId = new Map(compte.map((c) => [c.activityId, c._count._all]));

  return NextResponse.json(
    activities.map((a) => ({
      id: a.id,
      nom: a.nom,
      categorie: a.categorie,
      couleur: a.couleur,
      creneaux: parId.get(a.id) ?? 0,
    })),
  );
}

// POST /api/activities — création d'une activité (RH).
export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = activitySchema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  const existante = await prisma.activity.findFirst({
    where: { nom: { equals: d.nom, mode: "insensitive" } },
  });
  if (existante) return badRequest("Une activité porte déjà ce nom.");

  const activity = await prisma.activity.create({
    data: { nom: d.nom, categorie: d.categorie ?? null, couleur: d.couleur || "#3b82f6" },
  });
  return NextResponse.json(activity, { status: 201 });
}
