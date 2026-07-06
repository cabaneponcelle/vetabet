import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { loadGardesReprenables } from "@/lib/gardes";

// GET /api/gardes — liste des gardes à reprendre (tout utilisateur connecté).
export async function GET() {
  const guard = await requireSession();
  if (guard.error) return guard.error;

  const gardes = await loadGardesReprenables();
  // Un vétérinaire ne voit pas ses propres créneaux comme « à reprendre ».
  const myWorkerId = guard.session!.user.workerId;
  return NextResponse.json(myWorkerId ? gardes.filter((g) => g.workerId !== myWorkerId) : gardes);
}
