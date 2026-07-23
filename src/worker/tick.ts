import { Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";
import { GrandPrixPublisher } from "../bot/grandPrixPublisher.js";
import { closeDb } from "../db/client.js";
import { PgGrandPrixRepository } from "../db/grandPrixRepository.js";
import { PgJobLogRepository } from "../db/jobLogRepository.js";

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to run worker tick.");
}

const grandPrixRepository = new PgGrandPrixRepository();
const jobLogRepository = new PgJobLogRepository();
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async () => {
  try {
    const publisher = new GrandPrixPublisher(client);

    await lockExpiredOpenGrandPrix(publisher);
    await openNextScheduledGrandPrix(publisher);
  } finally {
    await closeDb();
    await client.destroy();
  }
});

await client.login(env.DISCORD_TOKEN);

async function lockExpiredOpenGrandPrix(publisher: GrandPrixPublisher) {
  const openGrandPrix = await grandPrixRepository.getOpen();

  if (!openGrandPrix) {
    await jobLogRepository.create({
      jobName: "lock_expired_grand_prix",
      status: "skipped",
      message: "No open Grand Prix."
    });
    console.log("lock_expired_grand_prix skipped: no open Grand Prix.");
    return;
  }

  if (openGrandPrix.predictionsLockAt > new Date()) {
    await jobLogRepository.create({
      jobName: "lock_expired_grand_prix",
      status: "skipped",
      grandPrixId: openGrandPrix.id,
      message: "Open Grand Prix deadline is still in the future."
    });
    console.log(`lock_expired_grand_prix skipped: ${openGrandPrix.id} still open.`);
    return;
  }

  await grandPrixRepository.updateStatus(openGrandPrix.id, "locked");
  const lockedGrandPrix = await grandPrixRepository.get(openGrandPrix.id);

  if (!lockedGrandPrix) {
    throw new Error(`Grand Prix ${openGrandPrix.id} disappeared after locking.`);
  }

  const messageUrl = await publisher.publish(lockedGrandPrix);

  await jobLogRepository.create({
    jobName: "lock_expired_grand_prix",
    status: "success",
    grandPrixId: lockedGrandPrix.id,
    message: "Grand Prix predictions locked.",
    metadata: { messageUrl }
  });
  console.log(`lock_expired_grand_prix success: ${lockedGrandPrix.id}`);
}

async function openNextScheduledGrandPrix(publisher: GrandPrixPublisher) {
  const currentOpenGrandPrix = await grandPrixRepository.getOpen();

  if (currentOpenGrandPrix) {
    await jobLogRepository.create({
      jobName: "open_scheduled_grand_prix",
      status: "skipped",
      grandPrixId: currentOpenGrandPrix.id,
      message: "Another Grand Prix is already open."
    });
    console.log(`open_scheduled_grand_prix skipped: ${currentOpenGrandPrix.id} already open.`);
    return;
  }

  const nextGrandPrix = await grandPrixRepository.getNextScheduledToOpen();

  if (!nextGrandPrix) {
    await jobLogRepository.create({
      jobName: "open_scheduled_grand_prix",
      status: "skipped",
      message: "No scheduled Grand Prix is ready to open."
    });
    console.log("open_scheduled_grand_prix skipped: no GP ready.");
    return;
  }

  await grandPrixRepository.updateStatus(nextGrandPrix.id, "open");
  const openGrandPrix = await grandPrixRepository.get(nextGrandPrix.id);

  if (!openGrandPrix) {
    throw new Error(`Grand Prix ${nextGrandPrix.id} disappeared after opening.`);
  }

  const messageUrl = await publisher.publish(openGrandPrix);

  await jobLogRepository.create({
    jobName: "open_scheduled_grand_prix",
    status: "success",
    grandPrixId: openGrandPrix.id,
    message: "Grand Prix predictions opened.",
    metadata: { messageUrl }
  });
  console.log(`open_scheduled_grand_prix success: ${openGrandPrix.id}`);
}
