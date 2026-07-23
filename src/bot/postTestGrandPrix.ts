import { ChannelType, Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";
import { closeDb } from "../db/client.js";
import { PgGrandPrixRepository } from "../db/grandPrixRepository.js";
import { buildGrandPrixMessage } from "./grandPrixMessage.js";

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to post the test Grand Prix message.");
}

if (!env.DISCORD_PRONOSTICS_CHANNEL_ID) {
  throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID is required to post the test Grand Prix message.");
}

const pronosticsChannelId = env.DISCORD_PRONOSTICS_CHANNEL_ID;
const grandPrixRepository = new PgGrandPrixRepository();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async () => {
  try {
    const channel = await client.channels.fetch(pronosticsChannelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID must target a text channel.");
    }

    const grandPrix = await grandPrixRepository.get("hungary_2026");

    if (!grandPrix) {
      throw new Error("Test Grand Prix hungary_2026 was not found. Run npm run db:seed first.");
    }

    const message = await channel.send(buildGrandPrixMessage(grandPrix));

    console.log(`Posted test Grand Prix message: ${message.url}`);
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
