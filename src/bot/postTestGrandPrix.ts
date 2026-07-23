import { ChannelType, Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";
import { testGrandPrix } from "../domain/grandPrix.js";
import { buildGrandPrixMessage } from "./grandPrixMessage.js";

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to post the test Grand Prix message.");
}

if (!env.DISCORD_PRONOSTICS_CHANNEL_ID) {
  throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID is required to post the test Grand Prix message.");
}

const pronosticsChannelId = env.DISCORD_PRONOSTICS_CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async () => {
  try {
    const channel = await client.channels.fetch(pronosticsChannelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID must target a text channel.");
    }

    const message = await channel.send(buildGrandPrixMessage(testGrandPrix));

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
    await client.destroy();
  }
});

await client.login(env.DISCORD_TOKEN);
