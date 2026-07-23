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
    prediction.polemanDriverId,
    prediction.p1DriverId,
    prediction.p2DriverId,
    prediction.p3DriverId,
    prediction.fastestLapDriverId
  ].filter((driverId): driverId is string => Boolean(driverId));

  const unknownDriver = selectedDriverIds.find((driverId) => !activeDriverIds.has(driverId));

  if (unknownDriver) {
    return { ok: false, reason: `Pilote inconnu ou inactif: ${unknownDriver}.` };
  }

  const podiumDriverIds = [prediction.p1DriverId, prediction.p2DriverId, prediction.p3DriverId];
  const uniquePodiumDriverIds = new Set(podiumDriverIds);

  if (uniquePodiumDriverIds.size !== podiumDriverIds.length) {
    return {
      ok: false,
      reason: "Choisis trois pilotes differents pour P1, P2 et P3."
    };
  }

  return { ok: true };
}
