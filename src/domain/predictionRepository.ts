import type { PredictionInput } from "./types.js";

export type SavePredictionInput = {
  prediction: PredictionInput;
  discordUsername: string;
};

export interface PredictionRepository {
  get(discordUserId: string, grandPrixId: string): Promise<PredictionInput | undefined>;
  save(input: SavePredictionInput): Promise<void>;
}

export class InMemoryPredictionRepository implements PredictionRepository {
  private readonly predictions = new Map<string, PredictionInput>();

  async get(discordUserId: string, grandPrixId: string): Promise<PredictionInput | undefined> {
    return this.predictions.get(predictionKey(discordUserId, grandPrixId));
  }

  async save({ prediction }: SavePredictionInput): Promise<void> {
    this.predictions.set(predictionKey(prediction.discordUserId, prediction.grandPrixId), prediction);
  }
}

function predictionKey(discordUserId: string, grandPrixId: string) {
  return `${discordUserId}:${grandPrixId}`;
}
