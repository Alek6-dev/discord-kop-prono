import { closeDb } from "./client.js";
import { PgDriverRepository } from "./driverRepository.js";
import { PgGrandPrixRepository } from "./grandPrixRepository.js";
import { PgPredictionRepository } from "./predictionRepository.js";

const botProfiles = [
  {
    username: "Bot Max Attack",
    qualifying: ["max_verstappen", "lando_norris", "charles_leclerc"],
    race: [
      "max_verstappen",
      "lando_norris",
      "oscar_piastri",
      "charles_leclerc",
      "george_russell",
      "lewis_hamilton",
      "carlos_sainz",
      "alex_albon",
      "fernando_alonso",
      "pierre_gasly"
    ]
  },
  {
    username: "Bot Papaya",
    qualifying: ["lando_norris", "oscar_piastri", "max_verstappen"],
    race: [
      "lando_norris",
      "oscar_piastri",
      "max_verstappen",
      "charles_leclerc",
      "lewis_hamilton",
      "george_russell",
      "kimi_antonelli",
      "carlos_sainz",
      "fernando_alonso",
      "isack_hadjar"
    ]
  },
  {
    username: "Bot Tifosi",
    qualifying: ["charles_leclerc", "max_verstappen", "lando_norris"],
    race: [
      "charles_leclerc",
      "max_verstappen",
      "lando_norris",
      "lewis_hamilton",
      "oscar_piastri",
      "george_russell",
      "carlos_sainz",
      "fernando_alonso",
      "alex_albon",
      "pierre_gasly"
    ]
  },
  {
    username: "Bot Mercedes",
    qualifying: ["george_russell", "kimi_antonelli", "max_verstappen"],
    race: [
      "george_russell",
      "max_verstappen",
      "lando_norris",
      "kimi_antonelli",
      "oscar_piastri",
      "lewis_hamilton",
      "charles_leclerc",
      "carlos_sainz",
      "alex_albon",
      "fernando_alonso"
    ]
  },
  {
    username: "Bot Hadjar Hype",
    qualifying: ["isack_hadjar", "max_verstappen", "lando_norris"],
    race: [
      "isack_hadjar",
      "max_verstappen",
      "lando_norris",
      "oscar_piastri",
      "charles_leclerc",
      "george_russell",
      "lewis_hamilton",
      "carlos_sainz",
      "alex_albon",
      "fernando_alonso"
    ]
  },
  {
    username: "Bot Williams",
    qualifying: ["carlos_sainz", "alex_albon", "max_verstappen"],
    race: [
      "carlos_sainz",
      "alex_albon",
      "max_verstappen",
      "lando_norris",
      "oscar_piastri",
      "charles_leclerc",
      "george_russell",
      "lewis_hamilton",
      "fernando_alonso",
      "pierre_gasly"
    ]
  },
  {
    username: "Bot Safe Bet",
    qualifying: ["max_verstappen", "lando_norris", "oscar_piastri"],
    race: [
      "max_verstappen",
      "lando_norris",
      "charles_leclerc",
      "oscar_piastri",
      "george_russell",
      "lewis_hamilton",
      "kimi_antonelli",
      "carlos_sainz",
      "fernando_alonso",
      "alex_albon"
    ]
  },
  {
    username: "Bot Chaos",
    qualifying: ["fernando_alonso", "charles_leclerc", "george_russell"],
    race: [
      "fernando_alonso",
      "isack_hadjar",
      "carlos_sainz",
      "max_verstappen",
      "lando_norris",
      "alex_albon",
      "charles_leclerc",
      "oscar_piastri",
      "george_russell",
      "lewis_hamilton"
    ]
  },
  {
    username: "Bot Alpine",
    qualifying: ["pierre_gasly", "max_verstappen", "lando_norris"],
    race: [
      "pierre_gasly",
      "charles_leclerc",
      "max_verstappen",
      "lando_norris",
      "oscar_piastri",
      "george_russell",
      "lewis_hamilton",
      "franco_colapinto",
      "carlos_sainz",
      "fernando_alonso"
    ]
  },
  {
    username: "Bot Audi Gamble",
    qualifying: ["nico_hulkenberg", "max_verstappen", "lando_norris"],
    race: [
      "nico_hulkenberg",
      "max_verstappen",
      "lando_norris",
      "gabriel_bortoleto",
      "charles_leclerc",
      "oscar_piastri",
      "george_russell",
      "lewis_hamilton",
      "carlos_sainz",
      "alex_albon"
    ]
  }
];

async function seedBotPredictions() {
  const grandPrixRepository = new PgGrandPrixRepository();
  const predictionRepository = new PgPredictionRepository();
  const driverRepository = new PgDriverRepository();

  const grandPrixId = process.argv[2] ?? (await grandPrixRepository.getOpen())?.id;

  if (!grandPrixId) {
    throw new Error("Aucun Grand Prix ouvert. Usage: npm run dev:seed-predictions -- <grandPrixId>");
  }

  const activeDriverIds = new Set((await driverRepository.listActive()).map((driver) => driver.id));

  for (const [index, profile] of botProfiles.entries()) {
    const allDriverIds = [...profile.qualifying, ...profile.race];
    const unknownDriverId = allDriverIds.find((driverId) => !activeDriverIds.has(driverId));

    if (unknownDriverId) {
      throw new Error(`Pilote inconnu dans ${profile.username}: ${unknownDriverId}`);
    }

    await predictionRepository.save({
      discordUsername: profile.username,
      prediction: {
        grandPrixId,
        discordUserId: `bot_prono_${String(index + 1).padStart(2, "0")}`,
        qualifyingTop3DriverIds: profile.qualifying,
        raceTop10DriverIds: profile.race
      }
    });
  }

  console.log(`${botProfiles.length} pronos bots enregistres pour ${grandPrixId}.`);
}

try {
  await seedBotPredictions();
} finally {
  await closeDb();
}
