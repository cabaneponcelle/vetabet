import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api";
import { loadConflictsCached } from "@/lib/schedule";

// GET /api/conflicts — liste calculée des incohérences du brouillon (RH).
// Passe par un cache de quelques secondes : l'écran de planning redemande cette
// liste à chaque retour sur l'onglet, et son calcul parcourt tout le planning.
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const conflicts = await loadConflictsCached("DRAFT");
  return NextResponse.json(conflicts);
}
