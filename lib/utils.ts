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
