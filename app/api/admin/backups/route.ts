import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api";

// GET /api/admin/backups — liste les sauvegardes automatiques (Netlify Blobs).
export async function GET() {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("backups");
    const { blobs } = await store.list();
    const keys = blobs.map((b) => b.key).sort().reverse();
    return NextResponse.json({ keys });
  } catch {
    // Blobs indisponible (ex. en développement local) -> liste vide.
    return NextResponse.json({ keys: [], unavailable: true });
  }
}
