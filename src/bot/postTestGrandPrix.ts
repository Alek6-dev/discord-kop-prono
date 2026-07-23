import { Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";
import { closeDb } from "../db/client.js";
import { PgGrandPrixRepository } from "../db/grandPrixRepository.js";
import { GrandPrixPublisher } from "./grandPrixPublisher.js";

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to post the test Grand Prix message.");
}

const grandPrixRepository = new PgGrandPrixRepository();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async () => {
  try {
    const grandPrix = await grandPrixRepository.get("hungary_2026");

    if (!grandPrix) {
      throw new Error("Test Grand Prix hungary_2026 was not found. Run npm run db:seed first.");
    }

    const publisher = new GrandPrixPublisher(client);
    const messageUrl = await publisher.publish(grandPrix);

    console.log(`Published test Grand Prix message: ${messageUrl}`);
  } catch (error) {
    console.error(
      [
        "Unable to post the test Grand Prix message.",
        "",
        "Check that:",
        "- the bot has been invited to the Discord server",
        "- DISCORD_PRONOSTICS_CHANNEL_ID targets a text channel in that server",
        "- the bot can view the channel and send messages"
      ].join("\n")
    );
    throw error;
  } finally {
    await closeDb();
    await client.destroy();
  }
});

await client.login(env.DISCORD_TOKEN);
