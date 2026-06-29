// Garde le compute Neon éveillé pendant la vérification (ping toutes les 20s).
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

(async () => {
  for (let i = 1; i <= 18; i++) {
    try {
      await p.$queryRaw`SELECT 1`;
      console.log(`ping ${i} ok @ ${new Date().toISOString().slice(11, 19)}`);
    } catch (e) {
      console.log(`ping ${i} FAIL: ${(e as Error).message.split("\n")[0]}`);
    }
    await new Promise((r) => setTimeout(r, 20000));
  }
  await p.$disconnect();
})();
