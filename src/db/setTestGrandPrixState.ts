import { eq } from "drizzle-orm";
import { closeDb, db } from "./client.js";
import { grandPrix } from "./schema.js";

const grandPrixId = process.argv[2];
const status = process.argv[3];
const deadlineMode = process.argv[4] ?? "future";
const openMode = process.argv[5] ?? "ready";

if (!grandPrixId || !status || !["scheduled", "open", "locked"].includes(status)) {
  throw new Error(
    "Usage: npm run dev:set-gp-state -- <grandPrixId> <scheduled|open|locked> [future|past] [ready|not-ready]"
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
    .where(eq(grandPrix.id, grandPrixId));

  console.log(`${grandPrixId} status=${status} deadline=${deadlineMode} open=${openMode}`);
} finally {
  await closeDb();
}
