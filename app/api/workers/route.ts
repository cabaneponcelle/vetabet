import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdminApi, badRequest } from "@/lib/api";
import { workerSchema } from "@/lib/validation";
import { uniqueInternalEmail } from "@/lib/slug";

// GET /api/workers — liste des travailleurs (RH).
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const q = req.nextUrl.searchParams.get("q")?.toLowerCase();
  const workers = await prisma.worker.findMany({
    include: { user: true, availabilities: true },
    orderBy: { user: { prenom: "asc" } },
  });
  const data = workers
    .map((w) => ({
      id: w.id,
      userId: w.userId,
      prenom: w.user.prenom,
      nom: w.user.nom,
      email: w.user.email,
      fonction: w.fonction,
      telephone: w.telephone,
      actif: w.actif && w.user.actif,
      availabilities: w.availabilities.map((a) => ({
        jourSemaine: a.jourSemaine,
        heureDebut: a.heureDebut,
        heureFin: a.heureFin,
      })),
    }))
    .filter((w) =>
      q ? `${w.prenom} ${w.nom} ${w.email} ${w.fonction ?? ""}`.toLowerCase().includes(q) : true,
    );
  return NextResponse.json(data);
}

// POST /api/workers — création d'un travailleur + compte (RH).
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = workerSchema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const d = parsed.data;

  // Email = identifiant interne auto-généré (connexion par prénom + nom).
  const email = d.email
    ? d.email.toLowerCase().trim()
    : await uniqueInternalEmail(d.prenom, d.nom ?? "");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return badRequest("Un compte avec cet identifiant existe déjà.");

  const password = d.password && d.password.length >= 4 ? d.password : "veto1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const worker = await prisma.worker.create({
    data: {
      fonction: d.fonction ?? null,
      telephone: d.telephone ?? null,
      actif: d.actif ?? true,
      user: {
        create: {
          prenom: d.prenom,
          nom: d.nom ?? "",
          email,
          passwordHash,
          role: "WORKER",
          actif: d.actif ?? true,
        },
      },
      availabilities: d.availabilities?.length
        ? { create: d.availabilities }
        : undefined,
    },
    include: { user: true, availabilities: true },
  });

  return NextResponse.json(
    { id: worker.id, prenom: worker.user.prenom, email: worker.user.email },
    { status: 201 },
  );
}
