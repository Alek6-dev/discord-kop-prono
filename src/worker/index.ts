import { Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";
import { closeDb } from "../db/client.js";
import { PgJobLogRepository } from "../db/jobLogRepository.js";
import { runWorkerTick } from "./tick.js";

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to run the worker.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});
const jobLogRepository = new PgJobLogRepository();
let isTickRunning = false;
let interval: NodeJS.Timeout | undefined;

client.once(Events.ClientReady, async () => {
  console.log(`Worker started in ${env.NODE_ENV} mode.`);
  console.log(`Worker tick interval: ${env.WORKER_TICK_INTERVAL_MS}ms.`);

  await runTickSafely();
  interval = setInterval(runTickSafely, env.WORKER_TICK_INTERVAL_MS);
});

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await client.login(env.DISCORD_TOKEN);

async function runTickSafely() {
  if (isTickRunning) {
    console.log("worker_tick skipped: previous tick still running.");
    return;
  }

  isTickRunning = true;

  try {
    await runWorkerTick(client);
  } catch (error: unknown) {
    console.error("worker_tick error:", error);
    await jobLogRepository.create({
      jobName: "worker_tick",
      status: "error",
      message: error instanceof Error ? error.message : "Unknown worker tick error."
    });
  } finally {
    isTickRunning = false;
  }
}

async function shutdown() {
  if (interval) {
    clearInterval(interval);
  }

  client.destroy();
  await closeDb();
  process.exit(0);
}
