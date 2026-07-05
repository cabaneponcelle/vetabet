import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildBackup } from "@/lib/backup";

// GET /api/admin/backup — télécharge une sauvegarde JSON complète.
// Autorisé soit pour un admin connecté, soit via ?token=BACKUP_TOKEN
// (utilisé par la sauvegarde automatique planifiée).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const tokenOk = !!token && !!process.env.BACKUP_TOKEN && token === process.env.BACKUP_TOKEN;

  if (!tokenOk) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const backup = await buildBackup();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vetelio-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
