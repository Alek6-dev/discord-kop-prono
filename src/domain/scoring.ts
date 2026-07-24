import type { NormalizedRaceResult, PredictionInput } from "./types.js";

export type CommunityTrend = {
  totalPredictions: number;
  percentagesByDriverId: Record<string, number>;
};

export type ScoringTrends = {
  pole: CommunityTrend;
  winner: CommunityTrend;
};

export type ScoreRuleDetail = {
  rule: string;
  points: number;
  metadata?: Record<string, unknown>;
};

export type ScoreDetails = {
  qualifying: ScoreRuleDetail[];
  race: ScoreRuleDetail[];
  total: number;
};

export type ScoreResult = {
  totalPoints: number;
  qualifyingPoints: number;
  racePoints: number;
  details: ScoreDetails;
};

const POSITION_EXACT_POINTS = 5;
const IN_TARGET_ZONE_POINTS = 2;
const MIN_PREDICTIONS_FOR_RARITY_BONUS = 5;

export function calculatePredictionScore(
  prediction: PredictionInput,
  result: NormalizedRaceResult,
  trends: ScoringTrends = emptyScoringTrends()
): ScoreResult {
  const qualifyingDetails = scoreQualifying(prediction, result, trends.pole);
  const raceDetails = scoreRace(prediction, result, trends.winner);
  const qualifyingPoints = sumDetails(qualifyingDetails);
  const racePoints = sumDetails(raceDetails);
  const totalPoints = roundPoints(qualifyingPoints + racePoints);

  return {
    totalPoints,
    qualifyingPoints,
    racePoints,
    details: {
      qualifying: qualifyingDetails,
      race: raceDetails,
      total: totalPoints
    }
  };
}

export function calculatePoleTrend(predictions: PredictionInput[]): CommunityTrend {
  return calculatePositionTrend(predictions.map((prediction) => prediction.qualifyingTop3DriverIds[0]));
}

export function calculateWinnerTrend(predictions: PredictionInput[]): CommunityTrend {
  return calculatePositionTrend(predictions.map((prediction) => prediction.raceTop10DriverIds[0]));
}

export function emptyScoringTrends(): ScoringTrends {
  return {
    pole: { totalPredictions: 0, percentagesByDriverId: {} },
    winner: { totalPredictions: 0, percentagesByDriverId: {} }
  };
}

function scoreQualifying(
  prediction: PredictionInput,
  result: NormalizedRaceResult,
  poleTrend: CommunityTrend
) {
  const details: ScoreRuleDetail[] = [];
  const predicted = prediction.qualifyingTop3DriverIds;
  const actual = result.qualifyingTop3DriverIds;

  for (const [predictedIndex, driverId] of predicted.entries()) {
    const actualIndex = actual.indexOf(driverId);

    if (actualIndex === -1) {
      continue;
    }

    if (actualIndex === predictedIndex) {
      details.push({
        rule: "qualifying_position_exact",
        points: POSITION_EXACT_POINTS,
        metadata: { driverId, position: predictedIndex + 1 }
      });
      continue;
    }

    details.push({
      rule: "qualifying_in_top3_wrong_position",
      points: IN_TARGET_ZONE_POINTS,
      metadata: { driverId, predictedPosition: predictedIndex + 1, actualPosition: actualIndex + 1 }
    });

    const distance = Math.abs(actualIndex - predictedIndex);
    if (distance === 1) {
      details.push({
        rule: "qualifying_position_proximity",
        points: 0.5,
        metadata: { driverId, distance }
      });
    }
  }

  if (predicted[0] === actual[0]) {
    details.push({ rule: "poleman_exact", points: 4, metadata: { driverId: actual[0] } });
    pushRarityBonus(details, "poleman_rarity_bonus", actual[0], poleTrend);
  }

  const presentCount = countPresent(predicted, actual);
  const isExactTop3 = arraysEqual(predicted, actual);

  if (isExactTop3) {
    details.push({ rule: "qualifying_top3_exact", points: 10 });
  } else if (presentCount === 3) {
    details.push({ rule: "qualifying_top3_unordered", points: 5 });
  } else if (presentCount === 2) {
    details.push({ rule: "qualifying_two_drivers_in_top3", points: 2 });
  }

  return details;
}

function scoreRace(
  prediction: PredictionInput,
  result: NormalizedRaceResult,
  winnerTrend: CommunityTrend
) {
  const details: ScoreRuleDetail[] = [];
  const predicted = prediction.raceTop10DriverIds;
  const actual = result.raceTop10DriverIds;

  for (const [predictedIndex, driverId] of predicted.entries()) {
    const actualIndex = actual.indexOf(driverId);

    if (actualIndex === -1) {
      if (predictedIndex === 9 && result.raceP11DriverId === driverId) {
        details.push({
          rule: "race_p10_p11_consolation",
          points: 0.25,
          metadata: { driverId }
        });
      }
      continue;
    }

    if (actualIndex === predictedIndex) {
      details.push({
        rule: "race_position_exact",
        points: POSITION_EXACT_POINTS,
        metadata: { driverId, position: predictedIndex + 1 }
      });
      continue;
    }

    details.push({
      rule: "race_in_top10_wrong_position",
      points: IN_TARGET_ZONE_POINTS,
      metadata: { driverId, predictedPosition: predictedIndex + 1, actualPosition: actualIndex + 1 }
    });

    const proximityPoints = raceProximityPoints(Math.abs(actualIndex - predictedIndex));
    if (proximityPoints > 0) {
      details.push({
        rule: "race_position_proximity",
        points: proximityPoints,
        metadata: { driverId, distance: Math.abs(actualIndex - predictedIndex) }
      });
    }
  }

  if (predicted[0] === actual[0]) {
    details.push({ rule: "winner_exact", points: 5, metadata: { driverId: actual[0] } });
    pushRarityBonus(details, "winner_rarity_bonus", actual[0], winnerTrend);
  }

  const predictedPodium = predicted.slice(0, 3);
  const actualPodium = actual.slice(0, 3);
  const isExactPodium = arraysEqual(predictedPodium, actualPodium);
  const isUnorderedPodium = countPresent(predictedPodium, actualPodium) === 3;

  if (isExactPodium) {
    details.push({ rule: "race_podium_exact", points: 10 });
  } else if (isUnorderedPodium) {
    details.push({ rule: "race_podium_unordered", points: 6 });
  }

  const presentCount = countPresent(predicted, actual);
  const quantityBonus = raceTop10QuantityBonus(presentCount);
  if (quantityBonus > 0) {
    details.push({
      rule: "race_top10_quantity_bonus",
      points: quantityBonus,
      metadata: { presentCount }
    });
  }

  if (hasThreeConsecutiveExactPositions(predicted, actual)) {
    details.push({ rule: "race_three_consecutive_exact", points: 2 });
  }

  if (arraysEqual(predicted, actual)) {
    details.push({ rule: "race_top10_exact", points: 40 });
  }

  return details;
}

function calculatePositionTrend(driverIds: Array<string | undefined>): CommunityTrend {
  const validDriverIds = driverIds.filter((driverId): driverId is string => Boolean(driverId));
  const percentagesByDriverId: Record<string, number> = {};

  for (const driverId of validDriverIds) {
    percentagesByDriverId[driverId] = (percentagesByDriverId[driverId] ?? 0) + 1;
  }

  for (const [driverId, count] of Object.entries(percentagesByDriverId)) {
    percentagesByDriverId[driverId] = roundPoints((count / validDriverIds.length) * 100);
  }

  return {
    totalPredictions: validDriverIds.length,
    percentagesByDriverId
  };
}

function pushRarityBonus(
  details: ScoreRuleDetail[],
  rule: string,
  driverId: string | undefined,
  trend: CommunityTrend
) {
  if (!driverId || trend.totalPredictions < MIN_PREDICTIONS_FOR_RARITY_BONUS) {
    return;
  }

  const percentage = trend.percentagesByDriverId[driverId] ?? 0;
  const points = rarityBonusPoints(percentage);

  details.push({
    rule,
    points,
    metadata: { driverId, percentage, totalPredictions: trend.totalPredictions }
  });
}

function rarityBonusPoints(percentage: number) {
  if (percentage >= 50) {
    return 0.5;
  }
  if (percentage >= 25) {
    return 1;
  }
  if (percentage >= 10) {
    return 2;
  }
  if (percentage >= 5) {
    return 3;
  }
  return 5;
}

function raceProximityPoints(distance: number) {
  if (distance === 1) {
    return 1;
  }
  if (distance === 2) {
    return 0.75;
  }
  if (distance === 3) {
    return 0.5;
  }
  if (distance === 4) {
    return 0.25;
  }
  return 0;
}

function raceTop10QuantityBonus(presentCount: number) {
  const bonuses = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 9, 15];
  return bonuses[presentCount] ?? 0;
}

function countPresent(predicted: string[], actual: string[]) {
  const actualDriverIds = new Set(actual);
  return predicted.filter((driverId) => actualDriverIds.has(driverId)).length;
}

function hasThreeConsecutiveExactPositions(predicted: string[], actual: string[]) {
  let exactStreak = 0;

  for (const [index, driverId] of predicted.entries()) {
    if (driverId === actual[index]) {
      exactStreak += 1;
      if (exactStreak >= 3) {
        return true;
      }
      continue;
    }

    exactStreak = 0;
  }

  return false;
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sumDetails(details: ScoreRuleDetail[]) {
  return roundPoints(details.reduce((total, detail) => total + detail.points, 0));
}

function roundPoints(points: number) {
  return Math.round(points * 100) / 100;
}
