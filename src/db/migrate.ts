import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, db } from "./client.js";

async function main() {
  console.log("Applying database migrations...");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied.");
}

main()
  .catch((error) => {
    console.error("Database migration failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
