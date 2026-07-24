import { calculatePoleTrend, calculateWinnerTrend, type CommunityTrend } from "./scoring.js";
import type { PredictionInput } from "./types.js";

export type PredictionTrends = {
  pole: CommunityTrend;
  winner: CommunityTrend;
};

export const MIN_PREDICTIONS_FOR_PUBLIC_TRENDS = 5;

export function calculatePredictionTrends(predictions: PredictionInput[]): PredictionTrends {
  return {
    pole: calculatePoleTrend(predictions),
    winner: calculateWinnerTrend(predictions)
  };
}
