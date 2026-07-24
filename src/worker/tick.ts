import { pathToFileURL } from "node:url";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { GrandPrixPublisher } from "../bot/grandPrixPublisher.js";
import { env } from "../config/env.js";
import { closeDb } from "../db/client.js";
import { PgGrandPrixRepository } from "../db/grandPrixRepository.js";
import { PgJobLogRepository } from "../db/jobLogRepository.js";

export async function runWorkerTick(client: Client, now = new Date()): Promise<void> {
  const grandPrixRepository = new PgGrandPrixRepository();
  const jobLogRepository = new PgJobLogRepository();
  const publisher = new GrandPrixPublisher(client);

  await lockExpiredScheduledGrandPrix(grandPrixRepository, jobLogRepository, now);
  await lockExpiredOpenGrandPrix(grandPrixRepository, jobLogRepository, publisher, now);
  await openNextScheduledGrandPrix(grandPrixRepository, jobLogRepository, publisher, now);
}

async function lockExpiredScheduledGrandPrix(
  grandPrixRepository: PgGrandPrixRepository,
  jobLogRepository: PgJobLogRepository,
  now: Date
) {
  const expiredScheduledGrandPrix = await grandPrixRepository.listExpiredScheduled(now);

  if (expiredScheduledGrandPrix.length === 0) {
    console.log("lock_expired_scheduled_grand_prix skipped: no expired scheduled GP.");
    return;
  }

  for (const grandPrix of expiredScheduledGrandPrix) {
    await grandPrixRepository.updateStatus(grandPrix.id, "locked");
    await jobLogRepository.create({
      jobName: "lock_expired_scheduled_grand_prix",
      status: "success",
      grandPrixId: grandPrix.id,
      message: "Scheduled Grand Prix deadline already passed, locked without publishing."
    });
    console.log(`lock_expired_scheduled_grand_prix success: ${grandPrix.id}`);
  }
}

async function lockExpiredOpenGrandPrix(
  grandPrixRepository: PgGrandPrixRepository,
  jobLogRepository: PgJobLogRepository,
  publisher: GrandPrixPublisher,
  now: Date
) {
  const openGrandPrix = await grandPrixRepository.listOpen();

  if (openGrandPrix.length === 0) {
    console.log("lock_expired_grand_prix skipped: no open Grand Prix.");
    return;
  }

  let lockedCount = 0;

  for (const grandPrix of openGrandPrix) {
    if (grandPrix.predictionsLockAt > now) {
      console.log(`lock_expired_grand_prix skipped: ${grandPrix.id} still open.`);
      continue;
    }

    await grandPrixRepository.updateStatus(grandPrix.id, "locked");
    const lockedGrandPrix = await grandPrixRepository.get(grandPrix.id);

    if (!lockedGrandPrix) {
      throw new Error(`Grand Prix ${grandPrix.id} disappeared after locking.`);
    }

    const messageUrl = await publisher.publish(lockedGrandPrix);

    await jobLogRepository.create({
      jobName: "lock_expired_grand_prix",
      status: "success",
      grandPrixId: lockedGrandPrix.id,
      message: "Grand Prix predictions locked.",
      metadata: { messageUrl }
    });
    lockedCount += 1;
    console.log(`lock_expired_grand_prix success: ${lockedGrandPrix.id}`);
  }

  if (openGrandPrix.length > 1) {
    await jobLogRepository.create({
      jobName: "lock_expired_grand_prix",
      status: lockedCount > 0 ? "success" : "skipped",
      message: "Multiple open Grand Prix detected during lock check.",
      metadata: { openCount: openGrandPrix.length, lockedCount }
    });
  }
}

async function openNextScheduledGrandPrix(
  grandPrixRepository: PgGrandPrixRepository,
  jobLogRepository: PgJobLogRepository,
  publisher: GrandPrixPublisher,
  now: Date
) {
  const currentOpenGrandPrix = await grandPrixRepository.getOpen();

  if (currentOpenGrandPrix) {
    console.log(`open_scheduled_grand_prix skipped: ${currentOpenGrandPrix.id} already open.`);
    return;
  }

  const nextGrandPrix = await grandPrixRepository.getNextScheduledToOpen(now);

  if (!nextGrandPrix) {
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

async function runOnceFromCli() {
  if (!env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN is required to run worker tick.");
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once(Events.ClientReady, async () => {
    try {
      await runWorkerTick(client);
    } finally {
      await closeDb();
      client.destroy();
    }
  });

  await client.login(env.DISCORD_TOKEN);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runOnceFromCli();
}
