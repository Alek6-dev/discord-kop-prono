import { pathToFileURL } from "node:url";
import { calculatePredictionTrends } from "../domain/predictionTrends.js";
import { calculatePredictionScore } from "../domain/scoring.js";
import { closeDb } from "./client.js";
import { PgGrandPrixRepository } from "./grandPrixRepository.js";
import { PgPredictionRepository } from "./predictionRepository.js";
import { PgRaceResultRepository } from "./raceResultRepository.js";
import { PgScoreRepository } from "./scoreRepository.js";

export async function scoreGrandPrix(grandPrixId: string) {
  const grandPrixRepository = new PgGrandPrixRepository();
  const predictionRepository = new PgPredictionRepository();
  const raceResultRepository = new PgRaceResultRepository();
  const scoreRepository = new PgScoreRepository();

  const [grandPrix, result, predictions] = await Promise.all([
    grandPrixRepository.get(grandPrixId),
    raceResultRepository.get(grandPrixId),
    predictionRepository.listByGrandPrix(grandPrixId)
  ]);

  if (!grandPrix) {
    throw new Error(`Grand Prix introuvable: ${grandPrixId}`);
  }

  if (!result) {
    throw new Error(`Resultats introuvables pour ${grandPrix.name}.`);
  }

  const trends = calculatePredictionTrends(predictions);

  for (const prediction of predictions) {
    const score = calculatePredictionScore(prediction, result, trends);

    await scoreRepository.save({
      grandPrixId,
      discordUserId: prediction.discordUserId,
      points: score.totalPoints,
      details: score.details
    });
  }

  await grandPrixRepository.updateStatus(grandPrixId, "scored");

  return {
    grandPrix,
    scoredPredictions: predictions.length,
    leaderboard: await scoreRepository.listGrandPrixLeaderboard(grandPrixId)
  };
}

async function runFromCli() {
  const grandPrixId = process.argv[2];

  if (!grandPrixId) {
    throw new Error("Usage: npm run score:gp -- <grandPrixId>");
  }

  try {
    const result = await scoreGrandPrix(grandPrixId);

    console.log(`${result.grandPrix.name}: ${result.scoredPredictions} prono(s) score(s).`);

    for (const [index, entry] of result.leaderboard.entries()) {
      console.log(`${index + 1}. ${entry.discordUsername} - ${entry.points} pts`);
    }
  } finally {
    await closeDb();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runFromCli();
}
