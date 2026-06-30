import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api";

// GET /api/admin/backups/:key — télécharge une sauvegarde automatique stockée.
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;
  const { key } = await ctx.params;

  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("backups");
    const content = await store.get(key);
    if (!content) return NextResponse.json({ error: "Sauvegarde introuvable" }, { status: 404 });
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${key}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Stockage indisponible" }, { status: 503 });
  }
}
