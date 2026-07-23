import type { Driver, PredictionInput } from "./types.js";

export type PredictionValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validatePrediction(
  prediction: PredictionInput,
  activeDrivers: Driver[]
): PredictionValidationResult {
  const activeDriverIds = new Set(activeDrivers.map((driver) => driver.id));
  const selectedDriverIds = [
    ...prediction.qualifyingTop3DriverIds,
    ...prediction.raceTop10DriverIds
  ];

  const unknownDriver = selectedDriverIds.find((driverId) => !activeDriverIds.has(driverId));

  if (unknownDriver) {
    return { ok: false, reason: `Pilote inconnu ou inactif: ${unknownDriver}.` };
  }

  if (prediction.qualifyingTop3DriverIds.length !== 3) {
    return {
      ok: false,
      reason: "Choisis exactement 3 pilotes pour le top 3 des qualifs."
    };
  }

  if (prediction.raceTop10DriverIds.length !== 10) {
    return {
      ok: false,
      reason: "Choisis exactement 10 pilotes pour le top 10 du Grand Prix."
    };
  }

  const uniqueQualifyingDriverIds = new Set(prediction.qualifyingTop3DriverIds);

  if (uniqueQualifyingDriverIds.size !== prediction.qualifyingTop3DriverIds.length) {
    return {
      ok: false,
      reason: "Choisis 3 pilotes differents pour le top 3 des qualifs."
    };
  }

  const uniqueRaceDriverIds = new Set(prediction.raceTop10DriverIds);

  if (uniqueRaceDriverIds.size !== prediction.raceTop10DriverIds.length) {
    return {
      ok: false,
      reason: "Choisis 10 pilotes differents pour le top 10 du Grand Prix."
    };
  }

  return { ok: true };
}
