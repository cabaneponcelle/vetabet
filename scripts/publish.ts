// Publie le planning (DRAFT -> copies PUBLISHED) contre la base DATABASE_URL.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const drafts = await p.scheduleItem.findMany({ where: { status: "DRAFT" } });
  const published = await p.scheduleItem.findMany({ where: { status: "PUBLISHED" } });
  const bySource = new Map(published.map((x) => [x.sourceId, x]));
  const draftIds = new Set(drafts.map((d) => d.id));

  for (const pub of published) {
    if (!pub.sourceId || !draftIds.has(pub.sourceId)) {
      await p.scheduleItem.delete({ where: { id: pub.id } });
    }
  }
  let count = 0;
  for (const d of drafts) {
    const data = {
      titre: d.titre, description: d.description, date: d.date,
      heureDebut: d.heureDebut, heureFin: d.heureFin,
      workerId: d.workerId, roomId: d.roomId, activityId: d.activityId,
      status: "PUBLISHED" as const, sourceId: d.id, createdBy: d.createdBy,
    };
    const ex = bySource.get(d.id);
    if (ex) await p.scheduleItem.update({ where: { id: ex.id }, data });
    else await p.scheduleItem.create({ data });
    count++;
  }
  const totalPub = await p.scheduleItem.count({ where: { status: "PUBLISHED" } });
  console.log(`Publié : ${count} créneaux brouillon -> publiés. Total publiés en base : ${totalPub}`);
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
