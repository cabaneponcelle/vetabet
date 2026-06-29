// Client Prisma en singleton (évite d'épuiser les connexions en dev avec le HMR).
import { PrismaClient } from "@prisma/client";

// Résout l'URL de la base : priorité à DATABASE_URL ; à défaut, utilise la
// variable injectée automatiquement par Netlify DB (NETLIFY_DATABASE_URL). Pour
// la connexion poolée (PgBouncer), Prisma a besoin de `pgbouncer=true`.
function resolveDbUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const netlify = process.env.NETLIFY_DATABASE_URL;
  if (!netlify) return undefined; // -> Prisma retombe sur env("DATABASE_URL") du schéma
  if (netlify.includes("pgbouncer=")) return netlify;
  return netlify + (netlify.includes("?") ? "&" : "?") + "pgbouncer=true";
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDbUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
