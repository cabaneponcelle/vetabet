import { prisma } from "@/lib/db";

// Accès aux paramètres applicatifs (table Setting, clé/valeur).

export async function getSetting(cle: string, parDefaut = ""): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { cle } });
  return s?.valeur ?? parDefaut;
}

export async function setSetting(cle: string, valeur: string): Promise<void> {
  await prisma.setting.upsert({
    where: { cle },
    update: { valeur },
    create: { cle, valeur },
  });
}

// Clés connues (évite les fautes de frappe).
export const SETTINGS = {
  EMAIL_RH: "email_rh",
  WORKERS_VOIENT_GLOBAL: "workers_voient_planning_global",
  AVERTISSEMENTS_IGNORES: "avertissements_ignores",
} as const;

// ── Avertissements ignorés ───────────────────────────────────────────────────
// Stockés sous forme de tableau JSON de clés (voir conflictKey). Seuls les
// AVERTISSEMENTS peuvent être ignorés : les conflits bloquants restent visibles.

export async function getIgnoredConflictKeys(): Promise<string[]> {
  const raw = await getSetting(SETTINGS.AVERTISSEMENTS_IGNORES, "[]");
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

// Ajoute ou retire une clé. `stillPresent` sert à oublier les clés des
// incohérences qui n'existent plus (planning corrigé entre-temps).
export async function setConflictIgnored(
  key: string,
  ignored: boolean,
  stillPresent?: Set<string>,
): Promise<string[]> {
  const keys = new Set(await getIgnoredConflictKeys());
  if (ignored) keys.add(key);
  else keys.delete(key);
  const next = [...keys].filter((k) => !stillPresent || stillPresent.has(k));
  await setSetting(SETTINGS.AVERTISSEMENTS_IGNORES, JSON.stringify(next));
  return next;
}
