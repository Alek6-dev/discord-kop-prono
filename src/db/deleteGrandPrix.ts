import { eq } from "drizzle-orm";
import { closeDb, db } from "./client.js";
import { discordMessages, grandPrix, jobLogs, predictions, raceResults, scores } from "./schema.js";

const grandPrixId = process.argv[2];

if (!grandPrixId) {
  throw new Error("Usage: npm run dev:delete-gp -- <grandPrixId>");
}

try {
  await db.delete(scores).where(eq(scores.grandPrixId, grandPrixId));
  await db.delete(raceResults).where(eq(raceResults.grandPrixId, grandPrixId));
  await db.delete(predictions).where(eq(predictions.grandPrixId, grandPrixId));
  await db.delete(discordMessages).where(eq(discordMessages.grandPrixId, grandPrixId));
  await db.delete(jobLogs).where(eq(jobLogs.grandPrixId, grandPrixId));
  await db.delete(grandPrix).where(eq(grandPrix.id, grandPrixId));

  console.log(`Deleted Grand Prix ${grandPrixId}.`);
} finally {
  await closeDb();
}
