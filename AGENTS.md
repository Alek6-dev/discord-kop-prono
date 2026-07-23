# AGENTS.md - Memo projet Discord KOP Prono

Ce fichier sert de memoire courte pour reprendre le projet dans une nouvelle conversation Codex.

## Contexte produit

- Le projet est une app autonome de pronostics F1 pilotee depuis Discord, separee de l'app Fantasy F1 principale.
- Objectif: permettre aux membres Discord de jouer sans compte externe, directement avec boutons et menus Discord.
- Identite joueur retenue pour la V1: compte Discord (`discordUserId`, `discordUsername`).
- Le salon `#pronostics` doit contenir les messages de Grand Prix; le salon se remplira GP apres GP pendant la saison.
- Il ne doit y avoir qu'un seul Grand Prix ouvert a la fois.
- Le systeme vise a terme: configurer/importer la saison une fois, puis laisser le bot ouvrir/fermer les GP et publier les resultats automatiquement.

## Decisions de gameplay deja validees

- Pronostic demande pour l'instant: top 3 des qualifications + top 10 du Grand Prix.
- Les 22 pilotes F1 sont disponibles dans les menus de selection.
- L'interface Discord doit afficher un champ par position: `1er -> selectionner`, `2e -> selectionner`, etc.
- Pas de parcours ou seulement 4 lignes seraient visibles: les pronos sont decoupes en plusieurs etapes ephemeres pour rester utilisables.
- Pas de recap texte permanent dans le message principal; le message GP garde seulement les boutons utiles.
- Boutons du message GP:
  - GP ouvert: `Faire mon prono` + `Voir mon prono`
  - GP ferme/deadline depassee: seulement `Voir mon prono`
- Si un joueur essaie d'ouvrir le parcours alors que le GP est ferme, le message doit dire que les pronos ne sont plus disponibles, sans le laisser perdre son temps.
- Validation anti-doublon: un pilote ne peut pas etre choisi deux fois dans le top qualifs ou deux fois dans le top course.
- Les emojis pilotes personnalises du serveur Discord sont utilises dans les menus. Chaque pilote a besoin du couple `emojiName` + `emojiId`.

## Stack et structure

- TypeScript / Node.js / ESM.
- Discord.js pour le bot.
- PostgreSQL avec Drizzle ORM.
- Docker Compose pour Postgres local.
- Fastify prevu pour une interface admin minimale, mais l'admin n'est pas encore le sujet principal.
- Fly.io est l'hebergement cible a terme.

Structure utile:

```text
src/bot/       Bot Discord, messages GP, publication, scripts Discord
src/db/        Schema, repositories, scripts DB/dev
src/domain/    Types et regles metier
src/import/    Import calendrier saison via Jolpica
src/worker/    Jobs automatiques ouverture/fermeture
src/admin/     Admin web minimal a venir
```

## Etat Discord / secrets

- `.env` existe localement et contient les vraies valeurs; ne jamais afficher ni committer les secrets.
- `.env.example` sert de modele vide, sans valeurs secretes.
- Variables Discord attendues:
  - `DISCORD_TOKEN`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_GUILD_ID`
  - `DISCORD_PRONOSTICS_CHANNEL_ID`
  - `DISCORD_RESULTS_CHANNEL_ID`
  - `DISCORD_ADMIN_CHANNEL_ID`
- Le bot a ete cree dans Discord Developer Portal, invite sur le serveur, et fonctionne.
- Les anciens messages de test du salon pronostics ont ete nettoyes avec `npm run cleanup:pronostics`.

## Etat base de donnees local

- Postgres tourne via Docker.
- Migrations Drizzle appliquees.
- La saison 2026 reelle a ete importee depuis Jolpica.
- Le Grand Prix de test historique a ete supprime de la base.
- Etat local apres alignement au 23 juillet 2026:
  - `seasons: 1`
  - `grand_prix: 22`
  - `drivers: 22`
  - `predictions: 0`
  - `grand_prix_locked: 10`
  - `grand_prix_open: 1`
  - `grand_prix_scheduled: 11`
- GP actuellement ouvert en local: `hungarian_grand_prix_2026`.
- Message Discord officiel conserve pour ce GP: `Hungarian Grand Prix`, message id `1529902899180867677`.

## Import saison

- Un fichier reference `SyncSeasonCommand.php` a ete depose par l'utilisateur pour montrer la logique utilisee dans l'app Fantasy F1 principale.
- Ce fichier est une reference non suivie par Git; ne pas le committer sans demande explicite.
- La logique utile a ete adaptee, pas copiee telle quelle.
- L'import autonome se fait via Jolpica/Ergast dans `src/import/seasonCalendar.ts`.
- Les dates de pronostics:
  - `predictionsLockAt` = debut qualifs pour week-end normal, debut qualifs sprint pour week-end sprint.
  - `predictionsOpenAt` = 4 jours avant `predictionsLockAt`.
- La fenetre de 4 jours a ete choisie pour eviter de chevaucher trop facilement le GP precedent.

Commandes:

```bash
npm run import:season -- 2026
npm run apply:season-state -- 2026
npm run list:gp
```

## Bot Discord

- `src/bot/index.ts` gere les interactions Discord:
  - bouton `Faire mon prono`
  - bouton `Voir mon prono`
  - menus de selection position par position
  - validation
  - sauvegarde Postgres
- `src/bot/grandPrixMessage.ts` construit le message principal du GP selon son statut et sa deadline.
- `src/bot/grandPrixPublisher.ts` publie ou edite le message du GP de facon idempotente:
  - si un message est connu en base, il l'edite;
  - sinon il peut adopter un message existant du bot avec le meme nom;
  - sinon il en cree un nouveau;
  - il nettoie les doublons du meme GP.
- `src/db/discordMessageRepository.ts` stocke l'ID du message Discord principal par GP.

Commandes utiles:

```bash
npm run dev:bot
npm run post:gp -- hungarian_grand_prix_2026
npm run diagnose:discord
npm run list:emojis
npm run cleanup:pronostics
```

## Worker automatique

- `npm run worker:tick` execute un cycle ponctuel.
- `npm run dev:worker` lance un worker continu.
- Intervalle configurable via `WORKER_TICK_INTERVAL_MS`, valeur par defaut: `60000`.
- Le worker:
  - ferme les GP `open` dont la deadline est passee;
  - edite le message Discord du GP ferme;
  - ouvre le prochain GP `scheduled` dont `predictionsOpenAt <= now` et `predictionsLockAt > now`;
  - publie ou edite automatiquement son message Discord;
  - n'ouvre rien si un autre GP est deja ouvert;
  - verrouille les GP `scheduled` deja expires sans les publier.
- Le mode local bot + worker se lance avec deux commandes separees, mais l'utilisateur final n'a pas vocation a les lancer manuellement. En prod, Fly.io devra maintenir les process allumes.

Commandes:

```bash
npm run worker:tick
npm run dev:worker
```

## Scripts de dev et maintenance

- `npm run db:check`: compte les lignes principales et les statuts GP.
- `npm run dev:set-gp-state -- <gpId> open future`: met un GP en etat ouvert de test.
- `npm run dev:set-gp-state -- <gpId> locked future`: simule un GP verrouille.
- `npm run dev:set-gp-state -- <gpId> open past`: simule une deadline depassee.
- `npm run dev:delete-gp -- <gpId>`: supprime un GP et les donnees liees.
- `npm run cleanup:pronostics`: garde le message du GP actuellement ouvert et supprime les anciens messages de pronostics du bot dans le salon configure.

## Git / etat repo

- Le repo Git local existe.
- Commits importants recents:
  - `59965d5 feat: import season calendar from jolpica`
  - `af73018 fix: open predictions four days before lock`
  - `715df92 chore: align local database with real season`
  - `0b21a38 chore: add pronostics cleanup script`
  - `e5450ef feat: run grand prix worker continuously`
- `SyncSeasonCommand.php` est volontairement non suivi.
- Au moment de creer ce memo, aucun remote GitHub n'etait configure dans le repo local.

## Ce qui reste a discuter / prochaine conversation

- Sujet suivant prevu: scoring.
- Points a definir avant de coder:
  - Bareme exact pour top 3 qualifs.
  - Bareme exact pour top 10 course.
  - Gestion des positions exactes vs pilotes presents dans le top.
  - Bonus eventuels: podium exact, vainqueur exact, top 10 parfait, etc.
  - Classement GP, mensuel, saison.
  - Format des messages Discord de resultats.
  - Source et timing de recuperation automatique des resultats.
- Ne pas commencer le scoring avant discussion fonctionnelle avec l'utilisateur.

## Verification recente

Dernieres verifications effectuees avec succes:

```bash
npm run typecheck
npm run build
npm run worker:tick
npm run dev:worker
npm run db:check
```

`dev:worker` a ete lance brievement pour verification puis arrete.
