// Client Prisma en singleton (évite d'épuiser les connexions en dev avec le HMR).
import { PrismaClient } from "@prisma/client";

// Résout l'URL de la base : priorité à DATABASE_URL ; à défaut, utilise la
// variable injectée automatiquement par Netlify DB (NETLIFY_DATABASE_URL). Pour
// la connexion poolée (PgBouncer), Prisma a besoin de `pgbouncer=true`.
function resolveDbUrl(): string | undefined {
  const fromEnv = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;
  if (!fromEnv) return undefined; // -> Prisma retombe sur env("DATABASE_URL") du schéma

  const usingNetlify = !process.env.DATABASE_URL;
  let url = fromEnv;
  const ensure = (k: string, v: string) => {
    if (!url.includes(`${k}=`)) url += `${url.includes("?") ? "&" : "?"}${k}=${v}`;
  };

  // Pooler Netlify/Neon : Prisma a besoin de pgbouncer=true.
  if (usingNetlify) ensure("pgbouncer", "true");
  // Tolérance au réveil de Neon (veille de l'offre gratuite) : la 1re requête
  // après inactivité doit attendre le démarrage du compute.
  ensure("connect_timeout", "30");
  ensure("pool_timeout", "30");
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDbUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
