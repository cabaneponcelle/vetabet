// Reproduit la logique de connexion (authorize) contre la base pointée par DATABASE_URL.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const p = new PrismaClient();
(async () => {
  const user = await p.user.findFirst({
    where: {
      prenom: { equals: "admin", mode: "insensitive" },
      nom: { equals: "", mode: "insensitive" },
    },
  });
  console.log("admin trouvé:", !!user, "| prenom:", JSON.stringify(user?.prenom), "| nom:", JSON.stringify(user?.nom), "| actif:", user?.actif, "| role:", user?.role);
  if (user) console.log("admin1234 valide:", await bcrypt.compare("admin1234", user.passwordHash));

  const carole = await p.user.findFirst({ where: { prenom: { equals: "carole", mode: "insensitive" } } });
  console.log("carole trouvée:", !!carole, "| veto1234 valide:", carole ? await bcrypt.compare("veto1234", carole.passwordHash) : "n/a");
  await p.$disconnect();
})().catch((e) => { console.error("ERREUR:", e.message.split("\n")[0]); process.exit(1); });
