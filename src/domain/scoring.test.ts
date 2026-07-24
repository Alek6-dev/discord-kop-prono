import assert from "node:assert/strict";
import {
  calculatePoleTrend,
  calculatePredictionScore,
  calculateWinnerTrend
} from "./scoring.js";
import type { NormalizedRaceResult, PredictionInput } from "./types.js";

const result: NormalizedRaceResult = {
  grandPrixId: "hungarian_grand_prix_2026",
  qualifyingTop3DriverIds: ["max_verstappen", "lando_norris", "charles_leclerc"],
  raceTop10DriverIds: [
    "lando_norris",
    "max_verstappen",
    "charles_leclerc",
    "oscar_piastri",
    "george_russell",
    "lewis_hamilton",
    "carlos_sainz",
    "alexander_albon",
    "fernando_alonso",
    "pierre_gasly"
  ],
  raceP11DriverId: "isack_hadjar"
};

const perfectPrediction: PredictionInput = {
  grandPrixId: result.grandPrixId,
  discordUserId: "player_1",
  qualifyingTop3DriverIds: result.qualifyingTop3DriverIds,
  raceTop10DriverIds: result.raceTop10DriverIds
};

const perfectScore = calculatePredictionScore(perfectPrediction, result, {
  pole: calculatePoleTrend([
    perfectPrediction,
    { ...perfectPrediction, discordUserId: "player_2" },
    { ...perfectPrediction, discordUserId: "player_3" },
    { ...perfectPrediction, discordUserId: "player_4" },
    { ...perfectPrediction, discordUserId: "player_5" }
  ]),
  winner: calculateWinnerTrend([
    perfectPrediction,
    { ...perfectPrediction, discordUserId: "player_2" },
    { ...perfectPrediction, discordUserId: "player_3" },
    { ...perfectPrediction, discordUserId: "player_4" },
    { ...perfectPrediction, discordUserId: "player_5" }
  ])
});

assert.equal(perfectScore.qualifyingPoints, 29.5);
assert.equal(perfectScore.racePoints, 122.5);
assert.equal(perfectScore.totalPoints, 152);

const unorderedPrediction: PredictionInput = {
  grandPrixId: result.grandPrixId,
  discordUserId: "player_2",
  qualifyingTop3DriverIds: ["lando_norris", "charles_leclerc", "max_verstappen"],
  raceTop10DriverIds: [
    "max_verstappen",
    "charles_leclerc",
    "lando_norris",
    "oscar_piastri",
    "george_russell",
    "lewis_hamilton",
    "carlos_sainz",
    "alexander_albon",
    "fernando_alonso",
    "isack_hadjar"
  ]
};

const unorderedScore = calculatePredictionScore(unorderedPrediction, result, {
  pole: calculatePoleTrend([perfectPrediction, unorderedPrediction]),
  winner: calculateWinnerTrend([perfectPrediction, unorderedPrediction])
});

assert.ok(unorderedScore.details.qualifying.some((detail) => detail.rule === "qualifying_top3_unordered"));
assert.ok(unorderedScore.details.race.some((detail) => detail.rule === "race_podium_unordered"));
assert.ok(unorderedScore.details.race.some((detail) => detail.rule === "race_p10_p11_consolation"));

const rareWinnerTrend = calculateWinnerTrend([
  perfectPrediction,
  { ...perfectPrediction, discordUserId: "player_3", raceTop10DriverIds: ["max_verstappen"] },
  { ...perfectPrediction, discordUserId: "player_4", raceTop10DriverIds: ["max_verstappen"] },
  { ...perfectPrediction, discordUserId: "player_5", raceTop10DriverIds: ["charles_leclerc"] },
  { ...perfectPrediction, discordUserId: "player_6", raceTop10DriverIds: ["isack_hadjar"] }
]);

const rareWinnerScore = calculatePredictionScore(perfectPrediction, result, {
  pole: calculatePoleTrend([perfectPrediction]),
  winner: rareWinnerTrend
});

const rareWinnerBonus = rareWinnerScore.details.race.find(
  (detail) => detail.rule === "winner_rarity_bonus"
);

assert.equal(rareWinnerBonus?.points, 2);

console.log("scoring tests passed");
