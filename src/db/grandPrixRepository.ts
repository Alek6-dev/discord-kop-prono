import { eq } from "drizzle-orm";
import type { GrandPrix } from "../domain/types.js";
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

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      weekendType: row.weekendType,
      predictionsLockAt: row.predictionsLockAt
    };
  }
}
