import { eq } from "drizzle-orm";
import { closeDb, db } from "./client.js";
import { jobLogs } from "./schema.js";

async function main() {
  const deletedRows = await db.delete(jobLogs).where(eq(jobLogs.status, "skipped")).returning({
    id: jobLogs.id
  });

  console.log(`Deleted ${deletedRows.length} skipped job log(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to clean skipped job logs.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
