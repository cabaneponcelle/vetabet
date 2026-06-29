# Déploiement — Vetabet sur Netlify

## Recommandation

| Élément | Choix recommandé | Pourquoi |
|---|---|---|
| **Hébergement** | **Netlify** (ton compte premium) | Next.js 16 (SSR + routes API + middleware/proxy) tourne via le runtime officiel `@netlify/plugin-nextjs`. Le premium couvre les fonctions serverless, le build et la bande passante. |
| **Base de données** | **Netlify DB** (PostgreSQL Neon intégré) | Un seul outil, variable `DATABASE_URL` câblée automatiquement. *Alternative si tu veux du « toujours actif » sans mise en veille : **Supabase**.* |
| **Emails** | SMTP optionnel (sinon simulés) | Renseigne `SMTP_*` pour l'envoi réel des réclamations. |

> Netlify héberge très bien Next.js. (Vercel reste le plus « zéro-config » pour Next,
> mais puisque tu as déjà Netlify premium, autant l'utiliser.)

---

## Étapes

### 1. Pousser le code sur GitHub

Le dépôt git local est déjà initialisé et committé. Crée un dépôt GitHub puis :

```bash
git remote add origin https://github.com/<toi>/vetabet.git
git push -u origin main
```

### 2. Créer la base PostgreSQL

**Option A — Netlify DB (recommandé, intégré)**
Dans ton site Netlify → onglet **Storage / Database** → *Add Netlify DB* (Neon).
La variable `DATABASE_URL` est ajoutée automatiquement. Récupère aussi la chaîne
**poolée** (avec `-pooler`) pour l'usage serverless.

**Option B — Supabase**
[supabase.com](https://supabase.com) → New project → *Connection string* → choisis
**Transaction pooler** (port 6543). Ajoute `?pgbouncer=true` à la fin.

### 3. Connecter le dépôt à Netlify

Netlify → **Add new site → Import from Git** → choisis le dépôt.
Build détecté automatiquement (`netlify.toml` présent). Rien d'autre à régler.

### 4. Variables d'environnement (Netlify → Site settings → Environment variables)

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | chaîne **poolée** de ta base (ajoute `&pgbouncer=true` si pgbouncer/transaction pooler) |
| `AUTH_SECRET` | génère : `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_TRUST_HOST` | `true` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | (optionnel) pour les emails réels |

### 5. Initialiser la base de production

Une seule fois, depuis ton PC, en pointant temporairement sur la base cloud :

```bash
# Mets l'URL cloud (NON poolée, ou directe) dans DATABASE_URL le temps de la migration
npx prisma db push
npm run db:seed
npx tsx prisma/import-planning.ts   # importe les 547 créneaux de l'Excel
```

> Pour les migrations, utilise de préférence la connexion **directe** (sans `-pooler`).
> Pour le **runtime** sur Netlify, utilise la connexion **poolée**.

### 6. Déployer

Le push GitHub déclenche le build. À la fin, ton site est en ligne sur
`https://<ton-site>.netlify.app`. Connexion : prénom `admin` / `admin1234`
(à changer immédiatement via **Paramètres**).

---

## Notes techniques

- **Prisma** : `binaryTargets` inclut les cibles Linux (`rhel-openssl-3.0.x` /
  `1.0.x`) nécessaires aux fonctions Netlify ; `prisma generate` tourne au build
  (script `postinstall`).
- **Middleware/proxy** : le contrôle des rôles s'exécute via les Edge Functions Netlify.
- **Connexions DB** : en serverless, toujours préférer la chaîne **poolée**
  (`pgbouncer=true`) pour ne pas épuiser les connexions.
- **Sécurité** : change `AUTH_SECRET` et les mots de passe de démo en production.
