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
} as const;
