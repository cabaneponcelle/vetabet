import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api";
import { publishPlanning } from "@/lib/publish";

// POST /api/schedule/publish — publie le planning (RH).
export async function POST() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const result = await publishPlanning();
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Publication refusée : ${result.blocking} conflit(s) bloquant(s) à corriger d'abord.`,
        blocking: result.blocking,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, published: result.published });
}
