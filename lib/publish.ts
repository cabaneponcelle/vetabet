import { prisma } from "@/lib/db";
import { loadConflicts } from "@/lib/schedule";
import { hasBlocking } from "@/lib/conflicts";
import { setSetting } from "@/lib/settings";
import type { Prisma } from "@prisma/client";

export interface PublishResult {
  ok: boolean;
  published?: number;
  blocking?: number;
  crees?: number;
  modifies?: number;
  supprimes?: number;
}

// Champs recopiés du brouillon vers sa copie publiée.
const CHAMPS = [
  "titre",
  "description",
  "date",
  "heureDebut",
  "heureFin",
  "workerId",
  "roomId",
  "activityId",
  "createdBy",
] as const;

type Item = Prisma.ScheduleItemGetPayload<object>;
type Copie = Pick<Item, (typeof CHAMPS)[number]>;

// La copie publiée est-elle encore fidèle au brouillon ?
function aChange(copie: Item, brouillon: Copie): boolean {
  return CHAMPS.some((c) =>
    c === "date"
      ? copie.date.getTime() !== brouillon.date.getTime()
      : copie[c] !== brouillon[c],
  );
}

/**
 * Publie le planning : duplique l'ensemble des créneaux BROUILLON vers une copie
 * PUBLIÉE (visible des travailleurs). Les copies publiées sont mises à jour
 * (et non recréées) pour préserver les liens de réclamations. Refusé si des
 * conflits BLOQUANTS subsistent dans le brouillon — les avertissements, eux,
 * n'empêchent jamais de publier.
 *
 * Écriture en masse : une seule requête pour les suppressions, une seule pour
 * les créations, et une mise à jour uniquement pour les créneaux réellement
 * modifiés. Indispensable au-delà de quelques centaines de créneaux, sinon la
 * publication dépasse le temps d'exécution autorisé côté hébergeur.
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

  // 1) Copies publiées orphelines (brouillon supprimé entre-temps).
  const aSupprimer = published
    .filter((p) => !p.sourceId || !draftIds.has(p.sourceId))
    .map((p) => p.id);

  // 2) Brouillons sans copie publiée / copies à rafraîchir.
  const aCreer: Prisma.ScheduleItemCreateManyInput[] = [];
  const aModifier: { id: string; data: Prisma.ScheduleItemUncheckedUpdateInput }[] = [];
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
      createdBy: d.createdBy,
    };
    const existing = pubBySource.get(d.id);
    if (!existing) {
      aCreer.push({ ...data, status: "PUBLISHED", sourceId: d.id });
    } else if (aChange(existing, data)) {
      aModifier.push({ id: existing.id, data });
    }
  }

  await prisma.$transaction([
    ...(aSupprimer.length
      ? [prisma.scheduleItem.deleteMany({ where: { id: { in: aSupprimer } } })]
      : []),
    ...(aCreer.length ? [prisma.scheduleItem.createMany({ data: aCreer })] : []),
    ...aModifier.map((m) => prisma.scheduleItem.update({ where: { id: m.id }, data: m.data })),
  ]);

  await setSetting("derniere_publication", new Date().toISOString());
  return {
    ok: true,
    published: drafts.length,
    crees: aCreer.length,
    modifies: aModifier.length,
    supprimes: aSupprimer.length,
  };
}
