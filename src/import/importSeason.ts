import { closeDb, db } from "../db/client.js";
import { grandPrix, seasons } from "../db/schema.js";
import { fetchSeasonCalendar } from "./seasonCalendar.js";

const year = Number(process.argv[2]);

if (!Number.isInteger(year) || year < 1950) {
  throw new Error("Usage: npm run import:season -- <year>");
}

async function importSeason() {
  const races = await fetchSeasonCalendar(year);

  await db
    .insert(seasons)
    .values({
      id: String(year),
      label: `Saison ${year}`,
      year,
      isActive: false
    })
    .onConflictDoUpdate({
      target: seasons.id,
      set: {
        label: `Saison ${year}`,
        year,
        updatedAt: new Date()
      }
    });

  for (const race of races) {
    await db
      .insert(grandPrix)
      .values({
        id: race.id,
        seasonId: race.seasonId,
        name: race.name,
        country: race.country,
        round: race.round,
        weekendType: race.weekendType,
        status: "scheduled",
        raceStartsAt: race.raceStartsAt,
        qualifyingStartsAt: race.qualifyingStartsAt,
        sprintStartsAt: race.sprintStartsAt,
        sprintQualifyingStartsAt: race.sprintQualifyingStartsAt,
        predictionsOpenAt: race.predictionsOpenAt,
        predictionsLockAt: race.predictionsLockAt,
        resultsFetchAfterAt: race.resultsFetchAfterAt
      })
      .onConflictDoUpdate({
        target: grandPrix.id,
        set: {
          seasonId: race.seasonId,
          name: race.name,
          country: race.country,
          round: race.round,
          weekendType: race.weekendType,
          raceStartsAt: race.raceStartsAt,
          qualifyingStartsAt: race.qualifyingStartsAt,
          sprintStartsAt: race.sprintStartsAt,
          sprintQualifyingStartsAt: race.sprintQualifyingStartsAt,
          predictionsOpenAt: race.predictionsOpenAt,
          predictionsLockAt: race.predictionsLockAt,
          resultsFetchAfterAt: race.resultsFetchAfterAt,
          updatedAt: new Date()
        }
      });
  }

  console.log(`Imported F1 ${year} season: ${races.length} Grand Prix.`);
}

try {
  await importSeason();
} finally {
  await closeDb();
}
