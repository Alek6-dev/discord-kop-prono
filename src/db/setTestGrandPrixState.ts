import { eq } from "drizzle-orm";
import { closeDb, db } from "./client.js";
import { grandPrix } from "./schema.js";

const status = process.argv[2];
const deadlineMode = process.argv[3] ?? "future";
const openMode = process.argv[4] ?? "ready";

if (!status || !["scheduled", "open", "locked"].includes(status)) {
  throw new Error(
    "Usage: npm run dev:set-gp-state -- <scheduled|open|locked> [future|past] [ready|not-ready]"
  );
}

if (!["future", "past"].includes(deadlineMode)) {
  throw new Error("Deadline mode must be future or past.");
}

if (!["ready", "not-ready"].includes(openMode)) {
  throw new Error("Open mode must be ready or not-ready.");
}

const predictionsLockAt =
  deadlineMode === "future"
    ? new Date(Date.now() + 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 60 * 1000);
const predictionsOpenAt =
  openMode === "ready"
    ? new Date(Date.now() - 60 * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

try {
  await db
    .update(grandPrix)
    .set({
      status: status as "scheduled" | "open" | "locked",
      predictionsOpenAt,
      predictionsLockAt,
      updatedAt: new Date()
    })
    .where(eq(grandPrix.id, "hungary_2026"));

  console.log(`hungary_2026 status=${status} deadline=${deadlineMode} open=${openMode}`);
} finally {
  await closeDb();
}
