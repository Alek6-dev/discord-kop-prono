import type { GrandPrix } from "./types.js";

export type GrandPrixPredictionAvailability =
  | { ok: true }
  | { ok: false; reason: string };

export function assertPredictionsOpen(
  grandPrix: GrandPrix | undefined,
  now = new Date()
): GrandPrixPredictionAvailability {
  if (!grandPrix) {
    return {
      ok: false,
      reason: "Ce Grand Prix n'existe pas ou n'est pas encore configure."
    };
  }

  if (grandPrix.status !== "open") {
    return {
      ok: false,
      reason: "Les pronostics sont fermes pour ce Grand Prix."
    };
  }

  if (now >= grandPrix.predictionsLockAt) {
    return {
      ok: false,
      reason: "La deadline de pronostic est depassee pour ce Grand Prix."
    };
  }

  return { ok: true };
}
