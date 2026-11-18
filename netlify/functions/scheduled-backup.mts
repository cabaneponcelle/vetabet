import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Sauvegarde automatique : appelle l'endpoint de backup (protégé par token)
// puis stocke le JSON dans Netlify Blobs (store « backups »).
//
// Toutes les 6 heures plutôt qu'une fois par jour : un import ou une fausse
// manœuvre ne coûte ainsi au pire que quelques heures de saisie. Les copies
// les plus anciennes sont effacées pour ne pas accumuler indéfiniment.
const A_CONSERVER = 40; // ~10 jours à raison de 4 sauvegardes par jour

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
  const horodatage = new Date().toISOString().slice(0, 13).replace("T", "-"); // AAAA-MM-JJ-HH
  const key = `deiereklinik-${horodatage}h.json`;
  await store.set(key, json);

  // Purge des plus anciennes : les clés commencent par la date, donc l'ordre
  // alphabétique est l'ordre chronologique.
  let supprimees = 0;
  try {
    const { blobs } = await store.list();
    const anciennes = blobs
      .map((b) => b.key)
      .sort()
      .slice(0, Math.max(0, blobs.length - A_CONSERVER));
    for (const k of anciennes) {
      await store.delete(k);
      supprimees++;
    }
  } catch {
    // La purge est accessoire : son échec ne doit pas faire échouer la sauvegarde.
  }

  return new Response(`Sauvegarde enregistrée : ${key} (${supprimees} ancienne(s) effacée(s))`);
};

// Toutes les 6 heures (00:00, 06:00, 12:00 et 18:00 UTC).
export const config: Config = { schedule: "0 */6 * * *" };
