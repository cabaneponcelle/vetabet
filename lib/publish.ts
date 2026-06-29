import { prisma } from "@/lib/db";
import { loadConflicts } from "@/lib/schedule";
import { hasBlocking } from "@/lib/conflicts";
import { setSetting } from "@/lib/settings";

export interface PublishResult {
  ok: boolean;
  published?: number;
  blocking?: number;
}

/**
 * Publie le planning : duplique l'ensemble des créneaux BROUILLON vers une copie
 * PUBLIÉE (visible des travailleurs). Les copies publiées sont mises à jour
 * (et non recréées) pour préserver les liens de réclamations. Refusé si des
 * conflits BLOQUANTS subsistent dans le brouillon.
 */
export async function publishPlanning(): Promise<PublishResult> {
  const conflicts = await loadConflicts("DRAFT");
  if (hasBlocking(conflicts)) {
    return { ok: false, blocking: conflicts.filter((c) => c.severite === "BLOQUANT").length };
  }

  const [drafts, published] = await Promise.all([
    prisma.scheduleItem.findMany({ where: { status: "DRAFT" } }),
    prisma.scheduleItem.findMany({ where: { status: "PUBLISHED" } }),
  ]);

  const pubBySource = new Map(published.map((p) => [p.sourceId, p]));
  const draftIds = new Set(drafts.map((d) => d.id));

  await prisma.$transaction(async (tx) => {
    // Supprime les copies publiées dont le brouillon source a disparu.
    for (const p of published) {
      if (!p.sourceId || !draftIds.has(p.sourceId)) {
        await tx.scheduleItem.delete({ where: { id: p.id } });
      }
    }
    // Crée ou met à jour la copie publiée de chaque brouillon.
    for (const d of drafts) {
      const data = {
        titre: d.titre,
        description: d.description,
        date: d.date,
        heureDebut: d.heureDebut,
        heureFin: d.heureFin,
        workerId: d.workerId,
        roomId: d.roomId,
        activityId: d.activityId,
        status: "PUBLISHED" as const,
        sourceId: d.id,
        createdBy: d.createdBy,
      };
      const existing = pubBySource.get(d.id);
      if (existing) await tx.scheduleItem.update({ where: { id: existing.id }, data });
      else await tx.scheduleItem.create({ data });
    }
  });

  await setSetting("derniere_publication", new Date().toISOString());
  return { ok: true, published: drafts.length };
}
