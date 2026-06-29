import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { loadItems } from "@/lib/schedule";
import { getSetting, SETTINGS } from "@/lib/settings";

// GET /api/schedule/published — planning PUBLIÉ pour les travailleurs.
//   mine=1            -> uniquement mes créneaux
//   sinon             -> planning global si autorisé par la RH, sinon les miens
export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (guard.error) return guard.error;
  const user = guard.session!.user;

  const sp = req.nextUrl.searchParams;
  const mine = sp.get("mine") === "1";

  const globalAutorise =
    user.role === "ADMIN" ||
    (await getSetting(SETTINGS.WORKERS_VOIENT_GLOBAL, "true")) === "true";

  // Détermine le périmètre travailleur.
  let workerId = sp.get("workerId") ?? undefined;
  if (mine) {
    workerId = user.workerId ?? "__none__";
  } else if (!globalAutorise) {
    workerId = user.workerId ?? "__none__";
  }

  const items = await loadItems({
    status: "PUBLISHED",
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    workerId,
    roomId: sp.get("roomId") ?? undefined,
  });

  return NextResponse.json({ items, globalAutorise });
}
