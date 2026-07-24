# Specification fonctionnelle - Concours de pronostics Discord Fantasy F1

## 1. Contexte

L'application principale Fantasy F1 existe deja, mais elle est recente et compte encore peu de joueurs. L'objectif n'est pas de remplacer cette application, ni de forcer immediatement les utilisateurs Discord a creer un compte Fantasy F1.

L'idee est de creer un petit jeu parallele de pronostics F1 directement accessible depuis le serveur Discord Fantasy F1. Ce mini-jeu doit servir de porte d'entree communautaire : les utilisateurs arrivent sur le Discord, participent facilement a un concours de pronostics, voient les classements et decouvrent progressivement l'ecosysteme Fantasy F1.

Le serveur Discord est actuellement peu peuple et peut etre utilise comme terrain de test. Les salons de test pourront etre prives pendant le developpement, ce qui permet d'iterer sans risque majeur pour la communaute existante.

## 2. Objectif produit

Construire une application autonome qui pilote un concours de pronostics F1 sur Discord.

Objectifs principaux :

- Permettre a un utilisateur Discord de faire ses pronostics pour chaque Grand Prix depuis Discord, sans commande texte obligatoire.
- Utiliser des boutons, menus deroulants et emojis pilotes pour offrir une experience propre et guidee.
- Publier automatiquement les classements par Grand Prix, par mois et sur la saison complete.
- Automatiser l'ouverture des pronostics, leur fermeture, la recuperation des resultats, le calcul des points et la publication Discord.
- Donner a l'administrateur une interface web minimale pour parametrer la saison et garder la main en cas de probleme.
- Garder le systeme independant de l'application Fantasy F1 principale.

Objectif important valide : le systeme doit tendre vers "je configure la saison une fois, puis je n'ai plus rien a faire".

## 3. Decisions deja validees

### 3.1 Application autonome

Le concours Discord ne doit pas etre une extension directe de l'application Fantasy F1 existante.

Il ne doit pas dependre de la base utilisateurs de l'app principale, ni lire directement les donnees internes de cette app.

Il peut reutiliser des idees, scripts ou logiques deja existantes, notamment pour l'automatisation des resultats F1, mais celles-ci devront etre adaptees dans une application separee.

### 3.2 Identite des joueurs

Au depart, l'identite d'un joueur est son compte Discord.

Le systeme stocke donc :

```text
discordUserId
discordUsername
pronostics
points
classements
```

Aucun compte Fantasy F1 n'est requis pour participer.

Une liaison de compte Fantasy F1 pourrait exister plus tard, mais elle ne fait pas partie du besoin initial.

### 3.3 Experience Discord native

L'utilisateur ne doit pas avoir a taper une commande comme `/prono` pour participer.

Le parcours souhaite :

```text
Le joueur rejoint le serveur Discord
Il va dans le salon pronostics
Il voit un message de Grand Prix
Il clique sur un bouton "Faire mon prono"
Il remplit ses choix via une interface Discord guidee
Il valide
Il recoit une confirmation privee
```

Discord ne permet pas d'injecter du HTML, du CSS ou du JavaScript dans son interface native. Il n'est donc pas possible de faire un vrai formulaire custom avec drag and drop de pilotes directement dans Discord.

L'interface doit utiliser les composants Discord disponibles :

- messages
- boutons
- menus deroulants
- formulaires natifs simples, appeles modals
- reponses privees, aussi appelees ephemeres
- roles Discord

### 3.4 Selection des pilotes

Le drag and drop n'est pas faisable directement dans Discord.

La solution retenue pour l'experience joueur est :

- plusieurs menus deroulants visibles dans le parcours de prono
- un champ 1er des qualifications, a selectionner
- un champ 2e des qualifications, a selectionner
- un champ 3e des qualifications, a selectionner
- un champ 1er du Grand Prix, a selectionner
- un champ 2e du Grand Prix, a selectionner
- et ainsi de suite jusqu'au champ 10e du Grand Prix
- validation anti-doublon au moment de la soumission

Le choix se fait donc en selectionnant les pilotes dans des listes.

Une alternative avait ete discutee : parcours sequentiel position par position, avec retrait automatique des pilotes deja selectionnes. Cette approche est techniquement possible, mais moins confortable car l'utilisateur peut vouloir modifier un choix precedent apres avoir rempli une autre position.

Decision retenue : faire pronostiquer pour le moment le top 3 des qualifications et le top 10 du Grand Prix avec des champs position par position, puis bloquer proprement a la validation si le meme pilote est selectionne plusieurs fois dans une meme liste.

### 3.5 Emojis pilotes

Les 22 portraits cartoon des pilotes ont ete uploades comme emojis personnalises sur le serveur Discord.

Ces emojis doivent etre utilises dans les menus deroulants.

Une option de menu pilote pourra ressembler a :

```text
:sainzKOP: Carlos Sainz
Williams - #55
```

Cote code, chaque pilote devra avoir un mapping technique :

```ts
{
  id: "carlos_sainz",
  label: "Carlos Sainz",
  team: "Williams",
  number: 55,
  emoji: {
    name: "SainzKOP",
    id: "123456789012345678"
  }
}
```

Le nom de l'emoji ne suffit pas toujours. Discord utilise le couple `name + id`.

Il faudra donc recuperer les IDs techniques des emojis du serveur, idealement via une commande ou un script admin du bot.

### 3.6 Classements

Le concours doit gerer trois niveaux de classement :

- classement du Grand Prix
- classement mensuel
- classement saison complete

### 3.7 Fermeture des pronostics

Les pronostics doivent se fermer automatiquement :

- au debut des qualifications pour un week-end normal
- au debut des qualifications sprint pour un week-end sprint

La fiche d'un Grand Prix doit donc contenir le type de week-end et les horaires de sessions necessaires.

### 3.8 Resultats automatises

L'administrateur ne veut pas saisir les resultats manuellement a chaque Grand Prix.

Le systeme doit recuperer les resultats automatiquement, ou adapter un script existant de l'application Fantasy F1 principale.

Principe valide :

- ne pas dependre directement de l'app Fantasy F1
- creer un module autonome de recuperation des resultats
- normaliser les resultats dans un format simple
- lancer la recuperation quelques heures apres l'evenement
- relancer automatiquement si les resultats ne sont pas encore disponibles

Exemple de structure normalisee :

```json
{
  "grandPrixId": "hungary_2026",
  "qualifyingTop3": [
    "charles_leclerc",
    "max_verstappen",
    "lando_norris"
  ],
  "raceTop10": [
    "max_verstappen",
    "lando_norris",
    "charles_leclerc"
  ]
}
```

### 3.9 Recompenses Discord

Les recompenses ne sont pas prioritaires pour la premiere version.

Elements discutes :

- top 3 du Grand Prix
- leader mensuel
- leader saison
- roles Discord possibles

Clarification importante : Discord ne permet pas vraiment de creer un badge custom libre affiche a cote du pseudo dans chaque message comme dans une application de jeu. Les recompenses natives les plus proches sont les roles Discord, qui peuvent donner une couleur, un titre affiche sur le profil serveur, une place dans la liste des membres ou des permissions.

Les roles/recompenses seront donc gardes pour une iteration ulterieure.

## 4. Perimetre fonctionnel cible

### 4.1 Salons Discord

Le serveur devrait contenir au minimum :

```text
#pronostics
#resultats-pronostics
#admin-pronostics ou #logs-pronostics
```

Le salon `#pronostics` contient les messages de Grand Prix avec boutons.

Le salon `#resultats-pronostics` contient les classements publies automatiquement.

Le salon admin/logs est prive et sert aux alertes :

- resultats introuvables
- job echoue
- publication impossible
- recuperation relancee
- recalcul termine

### 4.2 Message de Grand Prix

Pour chaque Grand Prix, le bot doit poster un message dans `#pronostics`.

Exemple :

```text
Grand Prix de Hongrie

Pronostics ouverts jusqu'au samedi 25 juillet, 15:59.
Type de week-end : normal

A pronostiquer :
- Top 3 des qualifications
- Top 10 du Grand Prix

[Faire mon prono]
[Voir mon prono]
```

Quand le GP est verrouille, le message doit etre edite plutot que reposte :

```text
Grand Prix de Hongrie

Pronostics fermes.
Resultats en attente.

[Voir mon prono]
```

Le systeme doit stocker l'ID du message Discord pour pouvoir l'editer.

### 4.3 Parcours de prono joueur

Flux souhaite :

```text
1. Le joueur clique sur "Faire mon prono"
2. Le bot affiche une interface privee au joueur
3. Le joueur selectionne ses pilotes dans les menus
4. Le joueur clique sur "Valider"
5. Le backend valide les donnees
6. Le backend enregistre ou met a jour le prono
7. Le bot confirme au joueur
```

Validation minimale :

- GP ouvert
- utilisateur Discord valide
- les 3 pilotes du top 3 des qualifications doivent etre differents
- les 10 pilotes du top 10 du Grand Prix doivent etre differents
- les pilotes choisis doivent appartenir a la liste officielle active
- modification autorisee uniquement avant deadline

Message d'erreur exemple :

```text
Tu as selectionne Carlos Sainz plusieurs fois dans ton top 10 de course. Choisis dix pilotes differents avant de valider.
```

Confirmation exemple :

```text
Ton prono pour le Grand Prix de Hongrie est enregistre.
Tu peux le modifier jusqu'au samedi 25 juillet, 15:59.
```

### 4.4 Voir son prono

Le joueur doit pouvoir consulter son prono depuis le message de GP.

Le bot repond en prive :

```text
Ton prono - GP de Hongrie

Qualifs :
1. Charles Leclerc
2. Max Verstappen
3. Lando Norris

Course :
1. Lando Norris
2. Max Verstappen
3. Oscar Piastri
4. Charles Leclerc
5. Lewis Hamilton
6. George Russell
7. Carlos Sainz
8. Alexander Albon
9. Fernando Alonso
10. Pierre Gasly
```

### 4.5 Resultats et classements

Apres recuperation des resultats reels, le systeme doit :

- calculer les points de chaque joueur
- stocker les scores par GP
- mettre a jour le classement mensuel
- mettre a jour le classement saison
- publier ou editer les messages de classement dans `#resultats-pronostics`

Exemple :

```text
Classement - GP de Hongrie

1. MaxouF1 - 42 pts
2. LandoEnjoyer - 37 pts
3. Pierrot - 31 pts
```

Les messages de classement doivent etre idempotents : si le job tourne deux fois, le bot doit editer le message existant au lieu d'en poster un nouveau.

### 4.6 Bareme de scoring V1

Le scoring V1 repose sur plusieurs couches de points pour rendre chaque position utile :

- points forts pour une position exacte
- points plus faibles pour un pilote present dans la bonne zone mais mal place
- petits bonus de proximite
- bonus de groupe pour les pronostics remarquables
- bonus rarete communautaire sur la pole et le vainqueur

Bareme qualifs :

```text
5 pts par pilote a la position exacte
+2 pts par pilote dans le top 3 mais a la mauvaise position
+0.5 pt si le pilote est a 1 place d'ecart
+0 pt si le pilote est a 2 places d'ecart
+4 pts poleman exact
+2 pts si 2 pilotes sont presents dans le top 3
+5 pts si les 3 pilotes sont presents dans le top 3, dans le desordre
+10 pts si le top 3 qualif est exact
```

Les bonus de groupe qualifs se remplacent entre eux : top 3 exact remplace top 3 desordonne, qui remplace le bonus 2 pilotes.

Bareme course :

```text
+5 pts par pilote a la position exacte
+2 pts par pilote dans le top 10 mais a la mauvaise position
+1 pt si le pilote est a 1 place d'ecart
+0.75 pt si le pilote est a 2 places d'ecart
+0.5 pt si le pilote est a 3 places d'ecart
+0.25 pt si le pilote est a 4 places d'ecart
+0 pt a partir de 5 places d'ecart
+0.25 pt de consolation si le joueur met un pilote P10 et qu'il termine P11
+5 pts vainqueur exact
+6 pts podium desordonne
+10 pts podium exact
+2 pts si le joueur trouve au moins 3 positions consecutives exactes
+40 pts top 10 exact
```

Bonus nombre de bons pilotes dans le top 10 :

```text
1 bon pilote : +0.25 pt
2 bons pilotes : +0.5 pt
3 bons pilotes : +0.75 pt
4 bons pilotes : +1 pt
5 bons pilotes : +1.5 pts
6 bons pilotes : +2 pts
7 bons pilotes : +3 pts
8 bons pilotes : +5 pts
9 bons pilotes : +9 pts
10 bons pilotes : +15 pts
```

Podium exact remplace podium desordonne. Le top 10 exact s'ajoute au reste comme jackpot rare.

Bonus rarete communautaire :

```text
50% ou plus des joueurs ont fait ce choix : +0.5 pt
25% a 49% : +1 pt
10% a 24% : +2 pts
5% a 9% : +3 pts
moins de 5% : +5 pts
```

Le bonus rarete s'applique uniquement :

- au poleman exact en qualifs
- au vainqueur exact en course

Les tendances P1 peuvent etre affichees dans les menus Discord pendant que les pronostics sont ouverts. Elles sont visibles seulement a partir de 5 pronostics enregistres pour le GP :

```text
Qualifs 1er : pourcentage de joueurs ayant mis ce pilote en pole
Course 1er : pourcentage de joueurs ayant mis ce pilote vainqueur
```

Le bonus rarete utilise les tendances finales des pronostics verrouilles. Il ne s'applique qu'a partir de 5 pronostics enregistres pour le GP.

Gestion des egalites :

Pour l'instant, les joueurs a egalite de points restent ex-aequo. Le classement affiche le meme rang pour les scores identiques.

Un systeme de departage est garde en reserve si les egalites deviennent trop frequentes apres quelques Grands Prix :

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

## 5. Automatisation cible

### 5.1 Cycle de vie d'un Grand Prix

Chaque GP doit avoir un statut.

Statuts proposes :

```text
scheduled
open
locked
awaiting_results
scored
published
archived
```

Signification :

- `scheduled` : GP configure, pas encore ouvert.
- `open` : pronostics ouverts.
- `locked` : pronostics fermes.
- `awaiting_results` : l'evenement est termine ou cense l'etre, le systeme attend les resultats.
- `scored` : points calcules.
- `published` : classements publies sur Discord.
- `archived` : GP termine et stabilise.

### 5.2 Jobs automatiques

Le systeme doit executer des jobs selon le calendrier.

Exemple :

```text
Jeudi 10:00
-> ouvrir les pronostics du GP
-> poster/editer le message Discord

Samedi 16:00
-> fermer les pronostics
-> editer le message Discord

Dimanche 19:00
-> tenter de recuperer les resultats

Dimanche 19:15
-> retry si resultats indisponibles

Quand resultats disponibles
-> calculer les points
-> publier les classements
```

### 5.3 Retries et robustesse

Les resultats F1 peuvent ne pas etre disponibles exactement a l'heure prevue.

Le module de recuperation doit donc :

- tenter une premiere recuperation a l'heure configuree
- relancer automatiquement toutes les X minutes si les resultats sont absents
- limiter le nombre de tentatives ou basculer en etat d'alerte
- ecrire des logs
- notifier un salon admin si necessaire

Exemple d'alerte admin :

```text
Resultats GP Hongrie introuvables apres 6 tentatives.
Derniere tentative : 19:45.
Prochaine action requise : verifier la source ou relancer manuellement.
```

### 5.4 Idempotence

Regle technique fondamentale :

```text
Toute action automatique doit etre relancable sans creer de doublon.
```

Cela concerne :

- ouverture d'un GP
- fermeture d'un GP
- publication d'un message de GP
- recuperation des resultats
- calcul des scores
- publication des classements
- attribution eventuelle des roles

Exemple : si le job de publication du classement tourne deux fois, il ne doit pas poster deux messages. Il doit retrouver le message Discord deja stocke et l'editer.

## 6. Interface admin web

L'interface admin doit rester simple, surtout au debut.

Elle sert a configurer la saison et a garder le controle si quelque chose bugue.

### 6.1 Fonctions debut de saison

L'admin doit pouvoir creer ou importer :

- saison
- liste des Grands Prix
- type de week-end : normal ou sprint
- horaires des sessions
- deadline de prono
- heure de tentative de recuperation des resultats
- pilotes actifs
- equipes et numeros des pilotes
- mapping emojis Discord
- salons Discord utilises
- bareme de points

### 6.2 Fonctions de controle

L'admin doit pouvoir :

- voir le statut de chaque GP
- voir les derniers jobs executes
- voir les erreurs
- relancer la recuperation des resultats
- recalculer un GP
- republier un classement
- corriger manuellement un resultat si la source externe est mauvaise ou indisponible
- editer un horaire ou une deadline

### 6.3 Philosophie admin

L'objectif n'est pas de passer son temps dans l'admin.

L'interface existe surtout comme filet de securite :

- savoir ce qui se passe
- reprendre la main
- corriger un cas rare
- eviter d'aller modifier la base directement

## 7. Architecture proposee

### 7.1 Stack proposee

Stack recommandee pour ce projet autonome :

```text
TypeScript
Node.js
Discord.js
PostgreSQL
Drizzle ORM
Petite interface admin web
Worker/jobs scheduler
Fly.io
```

Cette stack n'est pas liee a l'application Fantasy F1 principale.

### 7.2 Pourquoi Node.js / TypeScript / Discord.js

Discord.js est une librairie Node.js tres mature pour construire des bots Discord.

Elle gere naturellement :

- connexion du bot
- boutons
- menus deroulants
- interactions
- messages ephemeres
- roles
- salons
- edition de messages

TypeScript apporte un filet de securite utile pour manipuler :

- IDs Discord
- pilotes
- statuts de GP
- resultats
- baremes
- jobs

### 7.3 Base de donnees

PostgreSQL est adapte pour stocker :

- saisons
- Grands Prix
- horaires
- joueurs Discord
- pronostics
- resultats
- scores
- classements
- messages Discord publies
- logs de jobs

Decision validee : ne pas utiliser Supabase comme base cible pour ce projet.

Decision validee : utiliser Drizzle ORM comme couche d'acces a la base.

Decision validee : heberger l'application autonome sur Fly.io, avec PostgreSQL egalement cote Fly.io si possible.

Motif : eviter les contraintes et irritants lies a Supabase, notamment la gestion de l'inactivite/projets qui dorment, et centraliser davantage l'hebergement de l'app, du bot, des jobs et de la base.

### 7.4 Hebergement cible

L'hebergement cible est Fly.io.

Architecture visee :

```text
GitHub
  |
  v
Fly.io
  |-- app/admin web
  |-- process bot Discord
  |-- process worker/jobs
  |-- PostgreSQL
```

Le projet peut etre deploye depuis un repo GitHub via `fly deploy`.

Fly.io est adapte au besoin car le bot Discord et le worker doivent tourner comme des processus longs, contrairement a une plateforme orientee fonctions courtes.

Deux structures sont possibles :

```text
Option simple :
Une app Fly.io avec plusieurs process
- web/admin
- bot
- worker

Option plus separee :
Plusieurs apps Fly.io
- fantasy-f1-pronos-admin
- fantasy-f1-pronos-bot
- fantasy-f1-pronos-worker
- fantasy-f1-pronos-db
```

Pour demarrer, l'option simple est suffisante si elle garde une separation claire dans le code entre admin, bot, worker et logique metier.

## 8. Explication Drizzle / PostgreSQL / Fly.io

### 8.1 Decision retenue : Drizzle

Drizzle est retenu pour ce projet.

Motifs :

- outil leger
- proche du SQL
- adapte a TypeScript
- moins opinionated qu'un ORM plus lourd
- compatible avec une base PostgreSQL hebergee sur Fly.io

Prisma reste une alternative connue, mais n'est pas le choix retenu pour cette application.

### 8.2 A quoi servent Drizzle et les outils similaires

Drizzle, Prisma, Kysely ou d'autres outils similaires sont des outils cote code pour parler a une base de donnees.

Ils ne remplacent pas PostgreSQL.

Ils ne remplacent pas l'hebergeur de la base.

Ils se placent entre ton application et ta base.

Schema mental :

```text
Code TypeScript
   |
   | Drizzle ORM
   v
Base PostgreSQL
   |
   | Hebergee sur Fly.io
```

### 8.3 Fly.io dans ce workflow

Fly.io peut jouer plusieurs roles :

- heberger l'interface admin web
- heberger le bot Discord comme process long-running
- heberger le worker de jobs automatiques
- heberger PostgreSQL ou un service PostgreSQL associe
- gerer les variables d'environnement/secrets de production

Dans ce projet, Fly.io devient l'hebergeur principal cible.

Le bot, le worker et l'admin app se connectent a la base PostgreSQL depuis l'environnement Fly.io.

### 8.4 Prisma

Prisma est un ORM.

Un ORM sert a manipuler la base avec du code plutot qu'en ecrivant du SQL partout.

Avec Prisma, tu definis un schema :

```prisma
model GrandPrix {
  id        String   @id
  name      String
  status    String
  startsAt  DateTime
}
```

Puis tu peux ecrire en TypeScript :

```ts
const gp = await prisma.grandPrix.findUnique({
  where: { id: "hungary_2026" }
})
```

Prisma gere aussi les migrations de base de donnees.

Forces :

- tres populaire
- bon typage TypeScript
- experience dev confortable
- schema lisible
- migrations integrees
- beaucoup d'exemples et documentation

Faiblesses :

- ajoute une couche assez opinionated
- peut etre moins proche du SQL pur
- client genere a build time
- parfois plus lourd que Drizzle

### 8.5 Drizzle

Drizzle est l'outil d'acces base retenu pour ce projet.

Il est plus proche du SQL que Prisma et se definit directement en TypeScript.

Tu definis tes tables en TypeScript :

```ts
export const grandPrix = pgTable("grand_prix", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  startsAt: timestamp("starts_at").notNull()
})
```

Puis tu peux ecrire :

```ts
const gp = await db
  .select()
  .from(grandPrix)
  .where(eq(grandPrix.id, "hungary_2026"))
```

Forces :

- leger
- tres TypeScript
- proche du SQL
- bon controle sur les requetes
- adapte aux apps modernes serverless/edge dans certains cas

Faiblesses :

- un peu moins "magique" que Prisma
- demande parfois plus de rigueur SQL
- ecosysteme plus jeune que Prisma

### 8.6 Par quoi le remplacer

Alternatives possibles :

- SQL direct avec `pg`
- Kysely
- TypeORM
- Sequelize

SQL direct avec `pg` :

```text
+ controle total
+ simple conceptuellement
- beaucoup de SQL a maintenir
- moins de typage
- plus facile de faire des erreurs repetitives
```

Kysely :

```text
+ query builder TypeScript propre
+ proche SQL
- moins mainstream que Prisma
```

TypeORM / Sequelize :

```text
+ ORM connus
- souvent plus lourds
- moins agreables dans un projet TypeScript moderne
```

### 8.7 Positionnement pour ce projet

Pour ce projet, Drizzle sert a structurer proprement l'acces a la base.

Il aidera a manipuler :

- `Season`
- `GrandPrix`
- `Driver`
- `Prediction`
- `RaceResult`
- `Score`
- `Leaderboard`
- `DiscordMessage`
- `JobLog`

Avec Fly.io comme hebergeur cible, Drizzle reste compatible : Fly.io heberge l'application et PostgreSQL, Drizzle est utilise dans le code pour definir les tables, executer les migrations et lire/ecrire les donnees.

## 9. Mode de developpement retenu

Le projet doit etre construit de maniere iterative.

Pas besoin de passer plusieurs jours en cadrage complet avant d'ecrire du code.

En revanche, il ne faut pas partir totalement a l'arrache : les fondations doivent integrer des le depart :

- base de donnees
- statuts de GP
- stockage des IDs Discord
- logs
- jobs idempotents
- separation entre logique Discord et logique metier

Approche retenue :

```text
Iterer rapidement
Tester en salons Discord prives
Construire brique par brique
Garder les points de robustesse importants des le debut
```

## 10. Roadmap proposee

### Iteration 1 - Bot Discord minimum mais propre

Objectif : valider l'experience joueur dans Discord.

Fonctionnalites :

- connexion du bot Discord
- configuration du serveur
- salon prive de test
- message de Grand Prix
- bouton "Faire mon prono"
- menus deroulants pilotes position par position
- emojis pilotes dans les options
- pronostic top 3 des qualifications
- pronostic top 10 du Grand Prix
- validation anti-doublon dans chaque liste
- enregistrement du prono
- bouton "Voir mon prono"
- confirmation privee

### Iteration 2 - Modele saison et admin minimal

Objectif : ne plus coder les Grands Prix a la main.

Fonctionnalites :

- table saisons
- table Grands Prix
- type normal/sprint
- horaires de sessions
- deadline calculee
- statut du GP
- interface admin simple

### Iteration 3 - Automatisation ouverture/fermeture

Objectif : faire vivre le calendrier automatiquement.

Fonctionnalites :

- job d'ouverture des pronostics
- job de fermeture
- edition automatique des messages Discord
- logs admin
- protection contre les doubles publications

### Iteration 4 - Resultats, scoring et classements

Objectif : fermer la boucle de jeu.

Fonctionnalites :

- module de recuperation resultats
- retries si resultats indisponibles
- normalisation des resultats
- calcul des points
- classement GP
- classement mensuel
- classement saison
- publication dans le salon resultats

### Iteration 5 - Controle admin et robustesse

Objectif : garder la main quand l'automatisation rencontre un probleme.

Fonctionnalites :

- ecran jobs/logs
- relancer recuperation resultats
- recalculer GP
- republier classement
- override manuel d'un resultat
- alertes dans salon admin prive
- roles Discord eventuels

## 11. Points de vigilance

### 11.1 Discord n'est pas une app web

Discord ne permet pas une interface custom HTML/CSS.

Les menus, boutons et modals sont suffisants pour une experience propre, mais il faut accepter les contraintes natives de Discord.

### 11.2 Limites des menus Discord

Les options de menu peuvent contenir :

- label
- description
- emoji
- value technique

Elles ne peuvent pas contenir une grande image, une carte custom ou du drag and drop.

### 11.3 Emojis custom

Les emojis pilotes doivent etre geres via leurs IDs techniques.

Il faudra verifier que le bot a acces aux emojis du serveur et que les noms/IDs sont stables.

### 11.4 Permissions Discord

Le bot aura besoin de permissions pour :

- lire/interagir dans les salons configures
- poster des messages
- editer ses messages
- repondre aux interactions
- eventuellement gerer des roles

Pour les roles, le role du bot doit etre place au-dessus des roles qu'il doit attribuer.

### 11.5 Automatisation non aveugle

Le systeme doit etre autonome, mais pas silencieux.

Il doit signaler ses problemes :

- resultats indisponibles
- job echoue
- message Discord introuvable
- permission manquante
- mapping pilote manquant

### 11.6 Donnees F1

La fiabilite de la source de resultats sera critique.

Le systeme doit normaliser les donnees pour isoler le scoring de la source externe.

Le scoring ne doit pas dependre directement du format brut d'une API.

## 12. Questions restantes

Ces points restent a trancher plus tard, sans bloquer la premiere iteration :

- Bareme exact des points.
- Bareme exact pour le top 3 des qualifications et le top 10 du Grand Prix.
- Bonus eventuels ou non.
- Source exacte de resultats F1.
- Details exacts du deploiement Fly.io : une app multi-process ou plusieurs apps separees.
- Details exacts du schema Drizzle.
- Design exact de l'interface admin.
- Recompenses Discord et roles eventuels.
- Possibilite future de lier un compte Discord a un compte Fantasy F1.

## 13. Resume decisionnel

Le projet a construire est une application autonome de concours de pronostics F1 pour Discord.

Elle doit utiliser Discord comme interface joueur, mais garder sa propre logique, sa propre base et ses propres automatisations.

Elle ne doit pas dependre de l'application Fantasy F1 principale.

Elle doit etre developpee de maniere iterative, en commencant par un bot prive de test et un parcours joueur simple, puis en ajoutant l'admin, les jobs, les resultats, le scoring et la robustesse.

La contrainte produit majeure est l'automatisation : une fois la saison configuree, le systeme doit ouvrir, fermer, recuperer les resultats, calculer et publier autant que possible sans intervention manuelle.
