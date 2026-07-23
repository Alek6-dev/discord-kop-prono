import { count } from "drizzle-orm";
import { closeDb, db } from "./client.js";
import { drivers, grandPrix, predictions, seasons } from "./schema.js";

async function countRows(label: string, table: typeof seasons | typeof grandPrix | typeof drivers | typeof predictions) {
  const [result] = await db.select({ value: count() }).from(table);
  console.log(`${label}: ${result.value}`);
}

try {
  await countRows("seasons", seasons);
  await countRows("grand_prix", grandPrix);
  await countRows("drivers", drivers);
  await countRows("predictions", predictions);
} finally {
  await closeDb();
}
