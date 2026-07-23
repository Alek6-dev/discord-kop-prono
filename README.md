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
npm run diagnose:discord
npm run list:emojis
npm run post:test-gp
npm run print:invite-url
npm run docker:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:check
npm run dev:set-gp-state -- open future
npm run dev:set-gp-state -- locked future
npm run dev:set-gp-state -- open past
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
npm run dev:set-gp-state -- open future
npm run post:test-gp
```

Le message affiche `Faire mon prono` et `Voir mon prono`.

```bash
npm run dev:set-gp-state -- locked future
npm run post:test-gp
```

Le message affiche seulement `Voir mon prono`.

```bash
npm run dev:set-gp-state -- open past
npm run post:test-gp
```

Le message affiche seulement `Voir mon prono`, car la deadline est depassee.

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
