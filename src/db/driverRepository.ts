import { eq } from "drizzle-orm";
import type { Driver } from "../domain/types.js";
import { db } from "./client.js";
import { drivers } from "./schema.js";

export class PgDriverRepository {
  async listActive(): Promise<Driver[]> {
    const rows = await db.select().from(drivers).where(eq(drivers.isActive, true));

    return rows.map((driver) => ({
      id: driver.id,
      label: driver.label,
      team: driver.team,
      number: driver.number,
      emoji:
        driver.emojiName && driver.emojiId
          ? {
              name: driver.emojiName,
              id: driver.emojiId
            }
          : undefined
    }));
  }
}
