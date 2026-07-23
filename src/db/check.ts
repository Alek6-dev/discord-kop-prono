import { count } from "drizzle-orm";
import { closeDb, db } from "./client.js";
import { drivers, grandPrix, jobLogs, predictions, seasons } from "./schema.js";

try {
  const [seasonCount] = await db.select({ value: count() }).from(seasons);
  const [grandPrixCount] = await db.select({ value: count() }).from(grandPrix);
  const [driverCount] = await db.select({ value: count() }).from(drivers);
  const [predictionCount] = await db.select({ value: count() }).from(predictions);
  const [jobLogCount] = await db.select({ value: count() }).from(jobLogs);

  console.log(`seasons: ${seasonCount.value}`);
  console.log(`grand_prix: ${grandPrixCount.value}`);
  console.log(`drivers: ${driverCount.value}`);
  console.log(`predictions: ${predictionCount.value}`);
  console.log(`job_logs: ${jobLogCount.value}`);

  const [testGrandPrix] = await db.select().from(grandPrix).limit(1);

  if (testGrandPrix) {
    console.log(`grand_prix_status: ${testGrandPrix.status}`);
  }
} finally {
  await closeDb();
}
