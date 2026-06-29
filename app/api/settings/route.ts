import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/api";
import { setSetting } from "@/lib/settings";

// GET /api/settings — tous les paramètres (RH).
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const settings = await prisma.setting.findMany();
  const obj: Record<string, string> = {};
  for (const s of settings) obj[s.cle] = s.valeur;
  return NextResponse.json(obj);
}

// PATCH /api/settings — met à jour un ensemble de paramètres (RH).
export async function PATCH(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  for (const [cle, valeur] of Object.entries(body)) {
    await setSetting(cle, String(valeur));
  }
  return NextResponse.json({ ok: true });
}
