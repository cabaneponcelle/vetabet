# Planning Assistovet — Application web

Application de gestion d'emploi du temps pour une clinique vétérinaire
(remplace le planning Excel). Stack : **Next.js 16 (App Router) + TypeScript +
Prisma + PostgreSQL + Auth.js + Tailwind + FullCalendar**.

## Prérequis

- Node.js 20+ (testé avec Node 24)
- Une base **PostgreSQL** (recommandé : [Neon](https://neon.tech) gratuit, ou Supabase)

## Installation

```bash
npm install
```

## Configuration

1. Copier `.env.example` en `.env` (déjà fait : un `.env` existe).
2. Renseigner `DATABASE_URL` avec votre URL PostgreSQL Neon/Supabase, par ex. :
   ```
   DATABASE_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
   ```
3. `AUTH_SECRET` est déjà généré. Pour en régénérer un :
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
4. SMTP : laisser vide en développement (les emails de réclamation sont
   **simulés dans la console serveur**). Pour activer l'envoi réel, remplir les
   variables `SMTP_*`.

## Base de données

### Développement — PostgreSQL local (recommandé, toujours actif)

Un PostgreSQL portable est installé dans `C:\Users\timta\pglocal` (port **5433**,
base `vetabet`, user `postgres`, sans mot de passe). `.env` pointe déjà dessus.

```powershell
# Démarrer la base locale (idempotent — à relancer après un redémarrage du PC) :
powershell -ExecutionPolicy Bypass -File C:\Users\timta\claudeia\setup-pg.ps1
# Arrêter : C:\Users\timta\pglocal\pgsql\bin\pg_ctl.exe -D C:\Users\timta\pglocal\data stop
```

Puis, une seule fois pour peupler la base :

```bash
npm run db:push                  # crée les tables
npm run db:seed                  # activités, 22 vétos, salles, admin
npx tsx prisma/import-planning.ts # importe les 547 créneaux réels de l'Excel
```

### Production — Neon / Vercel

Dans `.env`, l'URL Neon (poolée) est conservée en commentaire. Pour déployer,
remettre cette ligne en `DATABASE_URL`, puis `npm run db:push` + `npm run db:seed`
(+ import) contre la base Neon. Neon (offre gratuite) met le compute en veille
après ~5 min : la 1ʳᵉ requête le réveille (d'où `connect_timeout=30` dans l'URL).

## Lancement

```bash
npm run dev         # http://localhost:3000
```

## Comptes de démonstration (après seed)

| Rôle  | Email                     | Mot de passe |
|-------|---------------------------|--------------|
| RH/Admin | `admin@assistovet.local` | `admin1234`  |
| Vétérinaire | `carole@assistovet.local` (prénom@…) | `veto1234` |

⚠️ **Changez ces mots de passe avant toute mise en production.**

## Scripts

| Commande            | Effet                                            |
|---------------------|--------------------------------------------------|
| `npm run dev`       | Serveur de développement                         |
| `npm run build`     | Build de production                              |
| `npm run test`      | Tests (moteur de détection de conflits, Vitest)  |
| `npm run db:push`   | Synchronise le schéma avec la base               |
| `npm run db:seed`   | Insère les données initiales                     |
| `npm run db:studio` | Explorateur de base Prisma Studio                |

## Déploiement (Vercel)

1. Pousser le code sur un dépôt Git.
2. Importer le projet dans Vercel.
3. Variables d'environnement Vercel : `DATABASE_URL`, `AUTH_SECRET`,
   `AUTH_TRUST_HOST=true`, et les `SMTP_*` si emails réels.
4. La base Neon/Supabase est accessible depuis Vercel (même URL).
5. Après le premier déploiement, lancer `db:push` + `db:seed` (ou une migration)
   contre la base de production.

## Architecture (résumé)

- `app/` — pages (espace `admin/`, espace `worker/`, `login/`) + routes `api/`.
- `lib/conflicts.ts` — **moteur de détection de conflits** (pur, testé).
- `lib/schedule.ts` — accès données planning + calcul des conflits.
- `lib/publish.ts` — logique brouillon → publié (copie réconciliée par `sourceId`).
- `lib/auth.ts` / `auth.config.ts` / `middleware.ts` — authentification + rôles.
- `prisma/schema.prisma` — modèle de données. `prisma/seed.ts` — données initiales.
- `components/` — UI (calendrier, modales, panneaux, tableaux…).

## Logique de détection des conflits

Voir `lib/conflicts.ts`. Deux familles de contrôles :
- **par créneau** : horaire invalide, créneau incomplet, salle/travailleur
  désactivé, hors disponibilités ;
- **par paire** (même date, chevauchement `startA < endB && endA > startB`) :
  salle déjà occupée, travailleur en double.

Les conflits **bloquants** empêchent la publication ; les **avertissements** non.
