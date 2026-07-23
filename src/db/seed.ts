import { testDrivers } from "../domain/drivers.js";
import { closeDb, db } from "./client.js";
import { drivers, seasons } from "./schema.js";

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

  console.log("Database seeded.");
}

try {
  await seed();
} finally {
  await closeDb();
}
