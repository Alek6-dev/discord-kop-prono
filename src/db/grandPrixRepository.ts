import { and, asc, eq, gt, lte } from "drizzle-orm";
import type { GrandPrix, GrandPrixStatus } from "../domain/types.js";
import { db } from "./client.js";
import { grandPrix } from "./schema.js";

export class PgGrandPrixRepository {
  async get(grandPrixId: string): Promise<GrandPrix | undefined> {
    const [row] = await db
      .select()
      .from(grandPrix)
      .where(eq(grandPrix.id, grandPrixId))
      .limit(1);

    if (!row) {
      return undefined;
    }

    return mapGrandPrix(row);
  }

  async getOpen(): Promise<GrandPrix | undefined> {
    const [row] = await db
      .select()
      .from(grandPrix)
      .where(eq(grandPrix.status, "open"))
      .orderBy(asc(grandPrix.predictionsLockAt))
      .limit(1);

    return row ? mapGrandPrix(row) : undefined;
  }

  async listOpen(): Promise<GrandPrix[]> {
    const rows = await db
      .select()
      .from(grandPrix)
      .where(eq(grandPrix.status, "open"))
      .orderBy(asc(grandPrix.predictionsLockAt), asc(grandPrix.round));

    return rows.map(mapGrandPrix);
  }

  async list(): Promise<GrandPrix[]> {
    const rows = await db
      .select()
      .from(grandPrix)
      .orderBy(asc(grandPrix.seasonId), asc(grandPrix.round));

    return rows.map(mapGrandPrix);
  }

  async getNextScheduledToOpen(now = new Date()): Promise<GrandPrix | undefined> {
    const [row] = await db
      .select()
      .from(grandPrix)
      .where(
        and(
          eq(grandPrix.status, "scheduled"),
          lte(grandPrix.predictionsOpenAt, now),
          gt(grandPrix.predictionsLockAt, now)
        )
      )
      .orderBy(asc(grandPrix.predictionsOpenAt), asc(grandPrix.round))
      .limit(1);

    return row ? mapGrandPrix(row) : undefined;
  }

  async listExpiredScheduled(now = new Date()): Promise<GrandPrix[]> {
    const rows = await db
      .select()
      .from(grandPrix)
      .where(
        and(
          eq(grandPrix.status, "scheduled"),
          lte(grandPrix.predictionsLockAt, now)
        )
      )
      .orderBy(asc(grandPrix.predictionsLockAt), asc(grandPrix.round));

    return rows.map(mapGrandPrix);
  }

  async updateStatus(grandPrixId: string, status: GrandPrixStatus): Promise<void> {
    await db
      .update(grandPrix)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(grandPrix.id, grandPrixId));
  }
}

type GrandPrixRow = typeof grandPrix.$inferSelect;

function mapGrandPrix(row: GrandPrixRow): GrandPrix {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    round: row.round,
    weekendType: row.weekendType,
    raceStartsAt: row.raceStartsAt,
    qualifyingStartsAt: row.qualifyingStartsAt ?? undefined,
    sprintStartsAt: row.sprintStartsAt ?? undefined,
    sprintQualifyingStartsAt: row.sprintQualifyingStartsAt ?? undefined,
    predictionsOpenAt: row.predictionsOpenAt ?? undefined,
    predictionsLockAt: row.predictionsLockAt
  };
}
