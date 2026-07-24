import { eq } from "drizzle-orm";
import type { NormalizedRaceResult } from "../domain/types.js";
import { db } from "./client.js";
import { raceResults } from "./schema.js";

export type SaveRaceResultInput = NormalizedRaceResult & {
  source?: string;
};

export class PgRaceResultRepository {
  async get(grandPrixId: string): Promise<NormalizedRaceResult | undefined> {
    const [row] = await db
      .select()
      .from(raceResults)
      .where(eq(raceResults.grandPrixId, grandPrixId))
      .limit(1);

    if (!row) {
      return undefined;
    }

    return {
      grandPrixId: row.grandPrixId,
      qualifyingTop3DriverIds: row.qualifyingTop3DriverIds,
      raceTop10DriverIds: row.raceTop10DriverIds,
      raceP11DriverId: row.raceP11DriverId ?? undefined
    };
  }

  async save(input: SaveRaceResultInput): Promise<void> {
    await db
      .insert(raceResults)
      .values({
        grandPrixId: input.grandPrixId,
        qualifyingTop3DriverIds: input.qualifyingTop3DriverIds,
        raceTop10DriverIds: input.raceTop10DriverIds,
        raceP11DriverId: input.raceP11DriverId,
        source: input.source ?? "admin"
      })
      .onConflictDoUpdate({
        target: raceResults.grandPrixId,
        set: {
          qualifyingTop3DriverIds: input.qualifyingTop3DriverIds,
          raceTop10DriverIds: input.raceTop10DriverIds,
          raceP11DriverId: input.raceP11DriverId,
          source: input.source ?? "admin",
          updatedAt: new Date()
        }
      });
  }
}
