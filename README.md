# Discord KOP Prono

Application autonome de concours de pronostics F1 pilotee depuis Discord.

La specification fonctionnelle se trouve dans :

- `spec-fonctionnelle-concours-pronostics-discord-fantasy-f1.md`

## Stack cible

- TypeScript
- Node.js
- Discord.js
- PostgreSQL
- Drizzle ORM
- Fastify pour l'admin web minimal
- Fly.io pour l'hebergement cible

## Structure initiale

```text
src/
  admin/    Interface admin minimale
  bot/      Bot Discord et interactions
  config/   Variables d'environnement
  db/       Client et schema Drizzle
  domain/   Types et logique metier
  worker/   Jobs automatiques
```

## Installation locale

```bash
npm install
```

Copier `.env.example` vers `.env`, puis renseigner les variables necessaires.

```bash
copy .env.example .env
```

## Commandes

```bash
npm run dev:admin
npm run dev:bot
npm run dev:worker
npm run worker:tick
npm run diagnose:discord
npm run cleanup:pronostics
npm run list:emojis
npm run list:gp
npm run import:season -- 2026
npm run post:gp -- australian_grand_prix_2026
npm run print:invite-url
npm run docker:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:check
npm run apply:season-state -- 2026
npm run score:gp -- australian_grand_prix_2026
npm run publish:leaderboard -- australian_grand_prix_2026
npm run start:migrate
npm run test:scoring
npm run dev:set-gp-state -- australian_grand_prix_2026 open future
npm run dev:set-gp-state -- australian_grand_prix_2026 locked future
npm run dev:set-gp-state -- australian_grand_prix_2026 open past
npm run dev:set-gp-state -- australian_grand_prix_2026 scheduled future ready
npm run dev:seed-predictions -- australian_grand_prix_2026
npm run dev:reset-scoring-test -- australian_grand_prix_2026
npm run typecheck
npm run build
```

## Variables Discord

Les secrets restent uniquement dans `.env`, jamais dans le chat ni dans Git.

```text
DISCORD_TOKEN                  Token du bot, depuis le Developer Portal Discord.
DISCORD_CLIENT_ID              Application ID / Client ID, depuis General Information.
DISCORD_GUILD_ID               ID du serveur Discord, copie depuis Discord avec Developer Mode.
DISCORD_PRONOSTICS_CHANNEL_ID  ID du salon ou poster les messages de Grand Prix.
DISCORD_RESULTS_CHANNEL_ID     ID du salon resultats-pronostics.
DISCORD_ADMIN_CHANNEL_ID       ID du salon admin/logs prive.
```

## Admin web

L'admin web est protege si `ADMIN_TOKEN` est renseigne dans `.env` ou dans les secrets de production.
Le token ne doit jamais etre commite. En production, `ADMIN_TOKEN` est obligatoire pour lancer l'admin.

## Deploiement Fly.io

Objectif prod: ne plus dependre du Docker local ni du PC allume. Pour la V1, Fly lance un seul process applicatif:

```text
app    admin Fastify + bot Discord + worker ouverture/fermeture GP
```

Le fichier `fly.toml` declare aussi une `release_command`:

```bash
npm run start:migrate
```

Cette commande applique les migrations Drizzle au debut de chaque deploiement, avant le remplacement des machines.

Premiere mise en route Fly:

```bash
flyctl auth login
flyctl apps create discord-kop-prono --yes
flyctl postgres create --name discord-kop-prono-db --region cdg --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
flyctl postgres attach discord-kop-prono-db --app discord-kop-prono --yes
```

Secrets a poser dans Fly, sans les afficher dans Git:

```text
DISCORD_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
DISCORD_PRONOSTICS_CHANNEL_ID
DISCORD_RESULTS_CHANNEL_ID
DISCORD_ADMIN_CHANNEL_ID
ADMIN_TOKEN
```

`DATABASE_URL` est cree par `flyctl postgres attach`.

Import depuis le `.env` local:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/import-fly-secrets.ps1
```

Si `ADMIN_TOKEN` manque dans `.env`, le script en genere un, l'ajoute localement au `.env` non commite, puis l'importe dans Fly.

Deploiement:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-fly.ps1
```

Le script force le deploiement sans HA automatique et rescale toujours a 1 machine applicative:

```bash
flyctl deploy --app discord-kop-prono --remote-only --yes --ha=false --vm-size shared-cpu-1x --vm-memory 512
flyctl scale count 1 --app discord-kop-prono --process-group app --yes
flyctl status --app discord-kop-prono
flyctl logs --app discord-kop-prono
```

Budget mensuel cible pour la V1:

```text
app unique 512 MB     $3.62/mois
postgres 256 MB       $2.21/mois
volume 1 GB           $0.15/mois
total                 $5.98/mois hors trafic/taxes
```

Note: un compte Fly.io neuf peut demander une carte ou du credit avant la creation de l'app/base.

Arret d'urgence:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/emergency-stop-fly.ps1
```

Ce script met l'app a 0 machine et stoppe la machine Postgres. Le volume Postgres reste facture tant qu'il existe, mais la consommation compute est arretee.

Audit budget:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/audit-fly-budget.ps1
```

Le script echoue si l'infra derive du budget cible: 1 machine app 512 MB, 1 machine Postgres 256 MB, 1 GB de volume Postgres.

Pour tester le message de Grand Prix dans Discord :

```bash
npm run print:invite-url
npm run dev:bot
npm run post:test-gp
```

Ouvre d'abord l'URL affichee par `npm run print:invite-url` pour inviter le bot sur le serveur.

Le bot doit ensuite tourner avec `npm run dev:bot` pour reagir aux boutons apres publication du message.

Pour tester les regles d'ouverture/fermeture :

```bash
npm run dev:set-gp-state -- australian_grand_prix_2026 open future
npm run post:gp -- australian_grand_prix_2026
```

Le message affiche `Faire mon prono` et `Voir mon prono`.

```bash
npm run dev:set-gp-state -- australian_grand_prix_2026 locked future
npm run post:gp -- australian_grand_prix_2026
```

Le message affiche seulement `Voir mon prono`.

```bash
npm run dev:set-gp-state -- australian_grand_prix_2026 open past
npm run post:gp -- australian_grand_prix_2026
```

Le message affiche seulement `Voir mon prono`, car la deadline est depassee.

Pour tester le worker manuel :

```bash
npm run dev:set-gp-state -- australian_grand_prix_2026 open past
npm run worker:tick
```

Le worker passe le GP en `locked` et edite son message Discord.

```bash
npm run dev:set-gp-state -- australian_grand_prix_2026 scheduled future ready
npm run worker:tick
```

Le worker passe le GP en `open` et publie ou edite son message Discord.

Pour laisser le worker tourner en continu :

```bash
npm run dev:worker
```

Il verifie periodiquement les deadlines, ferme les GP expires, ouvre le prochain GP eligible et publie/edite automatiquement le message Discord du GP ouvert. L'intervalle se regle avec `WORKER_TICK_INTERVAL_MS`.

## Premiere milestone produit

Le premier objectif est de valider le coeur du jeu en salon Discord prive :

```text
message de Grand Prix
-> bouton Faire mon prono
-> champs position par position pour le top 3 des qualifs
-> champs position par position pour le top 10 du Grand Prix
-> affichage en plusieurs messages Discord ephemeres : qualifs, course 1-5, course 6-10, validation
-> validation anti-doublon dans chaque liste
-> sauvegarde
-> bouton Voir mon prono
```

## Note scoring - egalites

Pour l'instant, les joueurs a egalite de points restent ex-aequo. Le classement affiche donc le meme rang pour les scores identiques.

Si les egalites deviennent trop frequentes apres quelques Grands Prix, un systeme de departage est deja pose :

```text
1. Podium course
   podium exact > podium desordonne > rien

2. Top 3 qualif
   top 3 exact > top 3 desordonne > 2 bons pilotes > rien

3. Meilleur vainqueur pronostique
   plus le pilote mis P1 finit haut, mieux c'est

4. Positions exactes course
   plus il y en a, mieux c'est

5. Pilotes dans le top 10 course
   plus il y en a, mieux c'est

6. Ex-aequo
```
