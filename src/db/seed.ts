import { testDrivers } from "../domain/drivers.js";
import { testGrandPrix } from "../domain/grandPrix.js";
import { closeDb, db } from "./client.js";
import { drivers, grandPrix, seasons } from "./schema.js";

async function seed() {
  await db
    .insert(seasons)
    .values({
      id: "2026",
      label: "Saison 2026",
      year: 2026,
      isActive: true
    })
    .onConflictDoUpdate({
      target: seasons.id,
      set: {
        label: "Saison 2026",
        year: 2026,
        isActive: true,
        updatedAt: new Date()
      }
    });

  for (const driver of testDrivers) {
    await db
      .insert(drivers)
      .values({
        id: driver.id,
        label: driver.label,
        team: driver.team,
        number: driver.number,
        emojiName: driver.emoji?.name,
        emojiId: driver.emoji?.id,
        isActive: true
      })
      .onConflictDoUpdate({
        target: drivers.id,
        set: {
          label: driver.label,
          team: driver.team,
          number: driver.number,
          emojiName: driver.emoji?.name,
          emojiId: driver.emoji?.id,
          isActive: true,
          updatedAt: new Date()
        }
      });
  }

  await db
    .insert(grandPrix)
    .values({
      id: testGrandPrix.id,
      seasonId: "2026",
      name: testGrandPrix.name,
      country: "Hongrie",
      round: 1,
      weekendType: testGrandPrix.weekendType,
      status: "open",
      raceStartsAt: new Date("2026-07-26T15:00:00+02:00"),
      qualifyingStartsAt: testGrandPrix.predictionsLockAt,
      predictionsOpenAt: new Date("2026-07-23T10:00:00+02:00"),
      predictionsLockAt: testGrandPrix.predictionsLockAt,
      resultsFetchAfterAt: new Date("2026-07-26T19:00:00+02:00")
    })
    .onConflictDoUpdate({
      target: grandPrix.id,
      set: {
        name: testGrandPrix.name,
        country: "Hongrie",
        round: 1,
        weekendType: testGrandPrix.weekendType,
        status: "open",
        raceStartsAt: new Date("2026-07-26T15:00:00+02:00"),
        qualifyingStartsAt: testGrandPrix.predictionsLockAt,
        predictionsLockAt: testGrandPrix.predictionsLockAt,
        updatedAt: new Date()
      }
    });

  console.log("Database seeded.");
}

try {
  await seed();
} finally {
  await closeDb();
}
