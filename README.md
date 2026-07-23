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

## Commandes

```bash
npm run dev:admin
npm run dev:bot
npm run dev:worker
npm run typecheck
npm run build
npm run db:generate
npm run db:migrate
```

## Premiere milestone produit

Le premier objectif est de valider le coeur du jeu en salon Discord prive :

```text
message de Grand Prix
-> bouton Faire mon prono
-> choix pilotes
-> top 3 des qualifs
-> top 10 du Grand Prix
-> validation anti-doublon dans chaque liste
-> sauvegarde
-> bouton Voir mon prono
```
