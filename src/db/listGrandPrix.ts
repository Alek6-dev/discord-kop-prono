import { closeDb } from "./client.js";
import { PgGrandPrixRepository } from "./grandPrixRepository.js";

const grandPrixRepository = new PgGrandPrixRepository();

try {
  const grandPrixList = await grandPrixRepository.list();

  for (const grandPrix of grandPrixList) {
    console.log(
      [
        grandPrix.id.padEnd(34),
        `R${String(grandPrix.round).padStart(2, "0")}`,
        grandPrix.status.padEnd(9),
        `opens=${formatDate(grandPrix.predictionsOpenAt)}`,
        `locks=${formatDate(grandPrix.predictionsLockAt)}`
      ].join(" | ")
    );
  }
} finally {
  await closeDb();
}

function formatDate(date?: Date) {
  return date?.toISOString() ?? "n/a";
}
