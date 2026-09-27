import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, badRequest } from "@/lib/api";
import { loadConflicts } from "@/lib/schedule";
import { conflictKey } from "@/lib/conflicts";
import { setConflictIgnored } from "@/lib/settings";

const schema = z.object({
  key: z.string().min(1),
  ignored: z.boolean(),
});

// POST /api/conflicts/ignore — met de côté (ou réaffiche) un AVERTISSEMENT.
// Les conflits bloquants ne peuvent pas être ignorés : ils doivent être corrigés.
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Données invalides", parsed.error.flatten());
  const { key, ignored } = parsed.data;

  const conflicts = await loadConflicts("DRAFT");
  const cible = conflicts.find((c) => conflictKey(c) === key);

  if (ignored) {
    if (!cible) return badRequest("Cette incohérence n'existe plus.");
    if (cible.severite !== "AVERTISSEMENT") {
      return badRequest("Un conflit bloquant ne peut pas être ignoré : corrigez-le.");
    }
  }

  // On en profite pour oublier les clés d'incohérences disparues.
  const presentes = new Set(
    conflicts.filter((c) => c.severite === "AVERTISSEMENT").map((c) => conflictKey(c)),
  );
  const keys = await setConflictIgnored(key, ignored, presentes);

  return NextResponse.json({ ok: true, ignored, count: keys.length });
}
