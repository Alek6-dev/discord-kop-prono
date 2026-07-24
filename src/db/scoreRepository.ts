import { desc, eq, sql } from "drizzle-orm";
import type { ScoreDetails } from "../domain/scoring.js";
import { db } from "./client.js";
import { discordPlayers, scores } from "./schema.js";

export type SaveScoreInput = {
  grandPrixId: string;
  discordUserId: string;
  points: number;
  details: ScoreDetails;
};

export type LeaderboardEntry = {
  discordUserId: string;
  discordUsername: string;
  points: number;
};

export type ScoreEntry = LeaderboardEntry & {
  details: ScoreDetails;
};

export class PgScoreRepository {
  async save(input: SaveScoreInput): Promise<void> {
    await db
      .insert(scores)
      .values({
        grandPrixId: input.grandPrixId,
        discordUserId: input.discordUserId,
        points: input.points,
        details: input.details
      })
      .onConflictDoUpdate({
        target: [scores.grandPrixId, scores.discordUserId],
        set: {
          points: input.points,
          details: input.details,
          calculatedAt: new Date()
        }
      });
  }

  async listGrandPrixLeaderboard(grandPrixId: string): Promise<LeaderboardEntry[]> {
    const rows = await db
      .select({
        discordUserId: scores.discordUserId,
        discordUsername: discordPlayers.discordUsername,
        points: scores.points
      })
      .from(scores)
      .innerJoin(discordPlayers, eq(scores.discordUserId, discordPlayers.discordUserId))
      .where(eq(scores.grandPrixId, grandPrixId))
      .orderBy(desc(scores.points), sql`${discordPlayers.discordUsername} asc`);

    return rows;
  }

  async getUserScore(grandPrixId: string, discordUserId: string): Promise<ScoreEntry | undefined> {
    const [row] = await db
      .select({
        discordUserId: scores.discordUserId,
        discordUsername: discordPlayers.discordUsername,
        points: scores.points,
        details: scores.details
      })
      .from(scores)
      .innerJoin(discordPlayers, eq(scores.discordUserId, discordPlayers.discordUserId))
      .where(sql`${scores.grandPrixId} = ${grandPrixId} and ${scores.discordUserId} = ${discordUserId}`)
      .limit(1);

    if (!row) {
      return undefined;
    }

    return {
      ...row,
      details: row.details as ScoreDetails
    };
  }
}
