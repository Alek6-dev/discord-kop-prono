import { closeDb } from "../db/client.js";
import { startAdmin } from "../admin/index.js";
import { startBot } from "../bot/index.js";
import { startWorker } from "../worker/index.js";

const botClient = await startBot();
const worker = await startWorker(botClient);
const admin = await startAdmin(botClient);

console.log("App process started: admin, bot and worker are running.");

async function shutdown() {
  console.log("App process shutting down...");
  await worker.stop();
  await admin.close();
  botClient.destroy();
  await closeDb();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
