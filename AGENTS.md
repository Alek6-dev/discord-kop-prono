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
- Fastify pour l'interface admin web minimale.
- Fly.io est l'hebergement de production retenu et deja branche.

Structure utile:

```text
src/bot/       Bot Discord, messages GP, publication, scripts Discord
src/db/        Schema, repositories, scripts DB/dev
src/domain/    Types et regles metier
src/import/    Import calendrier saison via Jolpica
src/worker/    Jobs automatiques ouverture/fermeture
src/admin/     Admin web minimal
src/app/       Process prod unique: admin + bot + worker
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
- L'admin web est protege par `ADMIN_TOKEN` en production. Le token doit rester uniquement dans `.env` local et les secrets Fly.
- Ne jamais committer `.env`, tokens Discord, token admin, URL Postgres complete, cookies, ou sortie de commande contenant des secrets.

## Etat production Fly.io

- App Fly: `discord-kop-prono`.
- Base Postgres Fly: `discord-kop-prono-db`.
- Region principale: `cdg`.
- Deploiement V1 retenu pour limiter le budget:
  - 1 machine applicative `shared-cpu-1x`, 512 MB.
  - 1 machine Postgres `shared-cpu-1x`, 256 MB.
  - 1 volume Postgres de 1 GB.
- Budget cible documente: environ 5.98 USD/mois hors trafic/taxes.
- L'app prod lance un process unique avec `npm run start:app`.
- `start:app` demarre ensemble:
  - admin Fastify
  - bot Discord
  - worker ouverture/fermeture GP
- `fly.toml` lance `npm run start:migrate` en `release_command` avant chaque deploiement.
- URL admin prod: `https://discord-kop-prono.fly.dev/`.
- Healthcheck prod: `https://discord-kop-prono.fly.dev/health`.
- L'app a ete deployee avec succes et le bot Discord repond en production.
- Un audit budget quotidien Codex a ete cree pour verifier que l'infra ne derive pas.
- Script d'urgence disponible: `scripts/emergency-stop-fly.ps1`.
- Script de deploiement disponible: `scripts/deploy-fly.ps1`.
- Script d'import secrets disponible: `scripts/import-fly-secrets.ps1`.
- Script d'audit budget disponible: `scripts/audit-fly-budget.ps1`.

## Etat base de donnees

- Postgres local tourne via Docker pour le dev.
- Postgres prod tourne via Fly.
- Migrations Drizzle appliquees en local et en prod.
- La saison 2026 reelle a ete importee depuis Jolpica.
- Le Grand Prix de test historique a ete supprime de la base.
- Etat de reference apres alignement:
  - `seasons: 1`
  - `grand_prix: 22`
  - `drivers: 22`
  - `grand_prix_locked: 10`
  - `grand_prix_open: 1`
  - `grand_prix_scheduled: 11`
- GP actuellement ouvert pour le test: `hungarian_grand_prix_2026`.
- Un prono utilisateur reel a ete enregistre en prod et apparait dans l'admin.

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
- Les tendances communautaires P1 sont affichees dans les menus pour:
  - `Q1` / pole
  - `R1` / vainqueur
- Les tendances ne deviennent visibles qu'a partir de 5 pronostics enregistres sur le GP.
- Le bouton `Voir mon score` envoie le detail en message ephemere, prive pour l'utilisateur.
- Le classement GP peut etre publie/edite de facon idempotente dans le salon resultats.

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
- Intervalle configurable via `WORKER_TICK_INTERVAL_MS`, valeur par defaut: `300000` (5 minutes).
- Le worker:
  - ferme les GP `open` dont la deadline est passee;
  - edite le message Discord du GP ferme;
  - ouvre le prochain GP `scheduled` dont `predictionsOpenAt <= now` et `predictionsLockAt > now`;
  - publie ou edite automatiquement son message Discord;
  - n'ouvre rien si un autre GP est deja ouvert;
  - verrouille les GP `scheduled` deja expires sans les publier.
- Les checks normaux sans action (`skipped`) ne sont plus ecrits dans `job_logs` pour eviter le bruit dans l'admin.
- Les logs admin doivent representer les actions utiles, erreurs, ou anomalies, pas le polling de surveillance.
- La deadline (`predictionsLockAt`) reste verifiee au moment des interactions Discord: un joueur ne doit pas pouvoir soumettre apres la deadline meme si le message Discord n'a pas encore ete mis a jour visuellement.
- Decision du 24 juillet 2026: garder le polling 5 minutes pour le test prive, car le cout est negligeable et la robustesse est bonne.

Commandes:

```bash
npm run worker:tick
npm run dev:worker
```

## Scoring V1

- Le moteur de scoring V1 est code dans `src/domain/scoring.ts`.
- Tests metier: `npm run test:scoring`.
- Le score supporte des points decimaux.
- Resultat normalise:
  - qualifs: `Q1` a `Q3`
  - course: `R1` a `R10`
  - consolation course: `P11`
- Le resultat peut etre saisi manuellement dans l'admin web pour la V1.
- L'automatisation future des resultats via API reste souhaitee, avec la saisie manuelle comme backup.
- Le recalcul d'un GP se fait avec `npm run score:gp -- <gpId>` ou via l'admin.
- Publication classement Discord: `npm run publish:leaderboard -- <gpId>` ou via l'admin.
- Details de score visibles dans l'admin et en ephemere Discord avec `Voir mon score`.

Bareme retenu:

```text
Qualifs:
- 5 pts par position exacte
- 2 pts par pilote dans le top 3 mais mauvaise position
- 0.5 pt bonus proximite a 1 place
- 4 pts poleman exact
- bonus de groupe: 2 bons pilotes +2, top 3 desordonne +5, top 3 exact +10

Course:
- 5 pts par position exacte
- 2 pts par pilote dans le top 10 mais mauvaise position
- proximite: 1 place +1, 2 places +0.75, 3 places +0.5, 4 places +0.25
- consolation unique P10 -> P11: +0.25
- vainqueur exact +5
- podium desordonne +6, podium exact +10
- 3 positions consecutives exactes +2
- top 10 exact +40
- nombre de bons pilotes top 10:
  1:+0.25, 2:+0.5, 3:+0.75, 4:+1, 5:+1.5,
  6:+2, 7:+3, 8:+5, 9:+9, 10:+15

Rarete communautaire:
- appliquee seulement poleman exact et vainqueur exact
- active a partir de 5 pronostics
- 50%+:+0.5, 25-49%:+1, 10-24%:+2, 5-9%:+3, <5%:+5
```

Egalites:

- Pour l'instant, les joueurs a egalite restent ex-aequo.
- Un systeme de departage est garde en reserve:
  1. podium course exact/desordonne
  2. top 3 qualif exact/desordonne/2 bons pilotes
  3. meilleur vainqueur pronostique
  4. nombre de positions exactes course
  5. nombre de pilotes dans le top 10 course
  6. ex-aequo

## Scripts de dev et maintenance

- `npm run db:check`: compte les lignes principales et les statuts GP.
- `npm run dev:set-gp-state -- <gpId> open future`: met un GP en etat ouvert de test.
- `npm run dev:set-gp-state -- <gpId> locked future`: simule un GP verrouille.
- `npm run dev:set-gp-state -- <gpId> open past`: simule une deadline depassee.
- `npm run dev:delete-gp -- <gpId>`: supprime un GP et les donnees liees.
- `npm run cleanup:pronostics`: garde le message du GP actuellement ouvert et supprime les anciens messages de pronostics du bot dans le salon configure.
- `npm run dev:seed-predictions -- <gpId>`: cree des pronos bots pour tester tendances/scoring.
- `npm run dev:reset-scoring-test -- <gpId>`: nettoie les donnees de scoring/test d'un GP.
- `npm run dev:cleanup-skipped-job-logs`: supprime localement les anciens logs `skipped`.
- `npm run start:cleanup-skipped-job-logs`: equivalent runtime prod compile.
- `npm run score:gp -- <gpId>`: recalcule les scores d'un GP.
- `npm run publish:leaderboard -- <gpId>`: publie/edite le classement Discord d'un GP.
- `npm run start:migrate`: applique les migrations Drizzle compilees.

## Test prive a venir

- Prochaine etape: test prive avec 2-3 personnes invitees par l'utilisateur.
- Le but du test prive est de valider en conditions reelles:
  - faire/modifier/voir son prono
  - tendances P1
  - reception admin
  - saisie resultat manuel
  - recalcul scores
  - detail admin
  - publication classement Discord
  - bouton `Voir mon score`
  - comportement apres deadline
- Pas de reset global avant le test sauf besoin explicite.
- Apres le test, Codex nettoiera les donnees de test si besoin.
- Le protocole complet sera documente plutot avant le prochain test public.
- Pour les permissions Discord du test:
  - role de test avec permissions globales minimales;
  - acces regles surtout via overrides de salons;
  - pas d'acces admin pour les testeurs.

## Git / etat repo

- Le repo Git local existe.
- Remote GitHub configure: `origin`.
- Commits importants recents:
  - `59965d5 feat: import season calendar from jolpica`
  - `af73018 fix: open predictions four days before lock`
  - `715df92 chore: align local database with real season`
  - `0b21a38 chore: add pronostics cleanup script`
  - `e5450ef feat: run grand prix worker continuously`
- `SyncSeasonCommand.php` est volontairement non suivi.
- Ne pas committer `SyncSeasonCommand.php` sans demande explicite.

## Ce qui reste apres le test prive

- Decider si un reset/nettoyage des donnees de test est necessaire.
- Documenter le protocole pour un test public.
- Creer un bot/environnement staging distinct quand le bot principal sera pret.
- Ameliorer l'admin prod plus tard si besoin (OAuth possible, mais non prioritaire).
- Automatiser la recuperation resultats via API quand la V1 manuelle est validee.
- Revoir eventuellement le scheduler vers un reveil precise + check de secours, mais le polling 5 minutes est garde pour l'instant.
- Observer les egalites et activer le departage seulement si besoin.

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
