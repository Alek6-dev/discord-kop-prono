import { and, eq } from "drizzle-orm";
import type { PredictionRepository, SavePredictionInput } from "../domain/predictionRepository.js";
import type { PredictionInput } from "../domain/types.js";
import { db } from "./client.js";
import { discordPlayers, predictions } from "./schema.js";

export class PgPredictionRepository implements PredictionRepository {
  async get(discordUserId: string, grandPrixId: string): Promise<PredictionInput | undefined> {
    const [prediction] = await db
      .select()
      .from(predictions)
      .where(
        and(
          eq(predictions.discordUserId, discordUserId),
          eq(predictions.grandPrixId, grandPrixId)
        )
      )
      .limit(1);

    if (!prediction) {
      return undefined;
    }

    return {
      grandPrixId: prediction.grandPrixId,
      discordUserId: prediction.discordUserId,
      qualifyingTop3DriverIds: prediction.qualifyingTop3DriverIds,
      raceTop10DriverIds: prediction.raceTop10DriverIds
    };
  }

  async save(input: SavePredictionInput): Promise<void> {
    await db
      .insert(discordPlayers)
      .values({
        discordUserId: input.prediction.discordUserId,
        discordUsername: input.discordUsername
      })
      .onConflictDoUpdate({
        target: discordPlayers.discordUserId,
        set: {
          discordUsername: input.discordUsername,
          updatedAt: new Date()
        }
      });

    await db
      .insert(predictions)
      .values({
        grandPrixId: input.prediction.grandPrixId,
        discordUserId: input.prediction.discordUserId,
        qualifyingTop3DriverIds: input.prediction.qualifyingTop3DriverIds,
        raceTop10DriverIds: input.prediction.raceTop10DriverIds
      })
      .onConflictDoUpdate({
        target: [predictions.grandPrixId, predictions.discordUserId],
        set: {
          qualifyingTop3DriverIds: input.prediction.qualifyingTop3DriverIds,
          raceTop10DriverIds: input.prediction.raceTop10DriverIds,
          updatedAt: new Date()
        }
      });
  }
}
