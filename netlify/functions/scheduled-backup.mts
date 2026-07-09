import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Sauvegarde automatique quotidienne : appelle l'endpoint de backup (protégé par
// token) puis stocke le JSON dans Netlify Blobs (store « backups »).
export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const token = process.env.BACKUP_TOKEN;
  if (!base || !token) {
    return new Response("Configuration manquante (URL ou BACKUP_TOKEN).", { status: 500 });
  }

  const res = await fetch(`${base}/api/admin/backup?token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    return new Response(`Échec du backup (${res.status}).`, { status: 502 });
  }
  const json = await res.text();

  const store = getStore("backups");
  const key = `deiereklinik-${new Date().toISOString().slice(0, 10)}.json`;
  await store.set(key, json);

  return new Response(`Sauvegarde enregistrée : ${key}`);
};

// Tous les jours à 02:00 UTC.
export const config: Config = { schedule: "0 2 * * *" };
