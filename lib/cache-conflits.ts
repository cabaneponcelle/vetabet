import type { Conflict } from "@/lib/conflicts";
import type { ItemStatus } from "@prisma/client";

// Le calcul des incohérences parcourt tout le planning : c'est de loin la
// requête la plus lourde de l'application. L'écran de planning la redemande à
// chaque ouverture et à chaque retour sur l'onglet, d'où ce cache très court.
// La publication, elle, recalcule toujours sur des données fraîches.
const TTL_MS = 15_000;

let cache: { status: ItemStatus; pose: number; valeur: Conflict[] } | null = null;

export function lireCacheConflits(status: ItemStatus): Conflict[] | null {
  if (!cache || cache.status !== status || Date.now() - cache.pose > TTL_MS) return null;
  return cache.valeur;
}

export function ecrireCacheConflits(status: ItemStatus, valeur: Conflict[]): void {
  cache = { status, pose: Date.now(), valeur };
}

export function invaliderCacheConflits(): void {
  cache = null;
}
