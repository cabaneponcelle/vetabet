import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Fusionne des classes Tailwind en gérant les conflits.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// "2026-07-13" depuis un objet Date (UTC), pour les champs de type date.
export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Formate "2026-07-13" -> "13/07/2026".
export function dateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// "2026-07-13" -> "Lundi 13/07/2026".
export function dateLongFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const jour = JOURS[(js + 6) % 7];
  return `${jour} ${dateFr(dateStr)}`;
}

// Lundi de la semaine contenant la date donnée.
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // 0 = lundi
  return new Date(ms - dow * 86_400_000).toISOString().slice(0, 10);
}

// Décale une date de n jours.
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}
