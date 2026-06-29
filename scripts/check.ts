import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  const t0 = Date.now();
  try {
    await p.$queryRaw`SELECT 1`;
    const [items, draft, workers, rooms, acts, admin] = await Promise.all([
      p.scheduleItem.count(),
      p.scheduleItem.count({ where: { status: "DRAFT" } }),
      p.worker.count(),
      p.room.count(),
      p.activity.count(),
      p.user.findFirst({ where: { role: "ADMIN" } }),
    ]);
    console.log("OK " + JSON.stringify({ items, draft, workers, rooms, acts, adminPrenom: admin?.prenom }));
  } catch (e) {
    const err = e as Error & { code?: string };
    console.log(`FAIL après ${Date.now() - t0}ms`);
    console.log("name:", err.name);
    console.log("code:", err.code);
    console.log("message:", err.message.split("\n").slice(0, 6).join(" | "));
  } finally {
    await p.$disconnect();
  }
})();
