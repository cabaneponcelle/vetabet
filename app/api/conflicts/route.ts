import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api";
import { loadConflicts } from "@/lib/schedule";

// GET /api/conflicts — liste calculée des incohérences du brouillon (RH).
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const conflicts = await loadConflicts("DRAFT");
  return NextResponse.json(conflicts);
}
