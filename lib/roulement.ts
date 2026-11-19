import { getSetting, SETTINGS } from "@/lib/settings";

// ── Roulement de quatre semaines ─────────────────────────────────────────────
// Le planning de la clinique tourne sur quatre semaines types : S1, S2, S3, S4,
// puis on recommence. « Semaine 1 » n'est donc pas la première semaine du mois
// mais un rang dans ce cycle. Pour savoir à quel rang correspond une date, il
// suffit d'un lundi de référence dont on sait qu'il est un S1.

// Calendrier fourni par la clinique : lundi 02/11/2026 = S1
// (d'où 16/11 = S3, 30/11 = S1, 04/01/2027 = S2…).
export const ANCRE_DEFAUT = "2026-11-02";

const JOUR_MS = 86_400_000;

export function lundiDe(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // 0 = lundi
  return new Date(ms - dow * JOUR_MS).toISOString().slice(0, 10);
}

/** Rang du roulement (1 à 4) de la semaine contenant cette date. */
export function rangRoulement(dateStr: string, ancre = ANCRE_DEFAUT): number {
  const semaines = Math.round(
    (Date.parse(`${lundiDe(dateStr)}T00:00:00Z`) - Date.parse(`${lundiDe(ancre)}T00:00:00Z`)) /
      (7 * JOUR_MS),
  );
  return (((semaines % 4) + 4) % 4) + 1;
}

/** Lundi de la prochaine semaine de ce rang, à partir d'une date donnée. */
export function prochainLundiDuRang(rang: number, depuis: string, ancre = ANCRE_DEFAUT): string {
  let lundi = lundiDe(depuis);
  for (let i = 0; i < 4; i++) {
    if (rangRoulement(lundi, ancre) === rang) return lundi;
    const [y, m, d] = lundi.split("-").map(Number);
    lundi = new Date(Date.UTC(y, m - 1, d) + 7 * JOUR_MS).toISOString().slice(0, 10);
  }
  return lundi;
}

export async function getAncreRoulement(): Promise<string> {
  const valeur = await getSetting(SETTINGS.ROULEMENT_ANCRE, ANCRE_DEFAUT);
  return /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : ANCRE_DEFAUT;
}
