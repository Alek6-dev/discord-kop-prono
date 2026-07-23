import { and, asc, eq, gt, lte } from "drizzle-orm";
import { closeDb, db } from "./client.js";
import { grandPrix, seasons } from "./schema.js";

const seasonId = process.argv[2];
const now = process.argv[3] ? new Date(process.argv[3]) : new Date();

if (!seasonId || Number.isNaN(now.getTime())) {
  throw new Error("Usage: npm run apply:season-state -- <seasonId> [nowIso]");
}

try {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);

  if (!season) {
    throw new Error(`Season ${seasonId} was not found. Run npm run import:season -- ${seasonId} first.`);
  }

  await db
    .update(grandPrix)
    .set({ status: "locked", updatedAt: new Date() })
    .where(and(eq(grandPrix.seasonId, seasonId), lte(grandPrix.predictionsLockAt, now)));

  await db
    .update(grandPrix)
    .set({ status: "scheduled", updatedAt: new Date() })
    .where(and(eq(grandPrix.seasonId, seasonId), gt(grandPrix.predictionsLockAt, now)));

  const [currentGrandPrix] = await db
    .select()
    .from(grandPrix)
    .where(
      and(
        eq(grandPrix.seasonId, seasonId),
        lte(grandPrix.predictionsOpenAt, now),
        gt(grandPrix.predictionsLockAt, now)
      )
    )
    .orderBy(asc(grandPrix.predictionsLockAt))
    .limit(1);

  if (currentGrandPrix) {
    await db
      .update(grandPrix)
      .set({ status: "open", updatedAt: new Date() })
      .where(eq(grandPrix.id, currentGrandPrix.id));
  }

  console.log(
    currentGrandPrix
      ? `Season ${seasonId} aligned. Current open GP: ${currentGrandPrix.id}.`
      : `Season ${seasonId} aligned. No GP is currently open.`
  );
} finally {
  await closeDb();
}
