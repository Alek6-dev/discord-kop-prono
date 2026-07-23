import { ChannelType, Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";
import { closeDb } from "../db/client.js";
import { PgDiscordMessageRepository } from "../db/discordMessageRepository.js";
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
const discordMessageRepository = new PgDiscordMessageRepository();

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

    const payload = buildGrandPrixMessage(grandPrix);
    const storedMessage = await discordMessageRepository.getGrandPrixMessage(grandPrix.id);
    const existingMessage = storedMessage
      ? await channel.messages.fetch(storedMessage.messageId).catch(() => undefined)
      : undefined;

    if (existingMessage) {
      const message = await existingMessage.edit(payload);
      await cleanupDuplicateGrandPrixMessages(channel, grandPrix.name, message.id);
      console.log(`Edited test Grand Prix message: ${message.url}`);
      return;
    }

    const adoptedMessage = await findLatestGrandPrixMessage(channel, grandPrix.name);

    if (adoptedMessage) {
      const message = await adoptedMessage.edit(payload);

      await discordMessageRepository.saveGrandPrixMessage({
        grandPrixId: grandPrix.id,
        channelId: channel.id,
        messageId: message.id
      });
      await cleanupDuplicateGrandPrixMessages(channel, grandPrix.name, message.id);
      console.log(`Adopted and edited test Grand Prix message: ${message.url}`);
      return;
    }

    const message = await channel.send(payload);

    await discordMessageRepository.saveGrandPrixMessage({
      grandPrixId: grandPrix.id,
      channelId: channel.id,
      messageId: message.id
    });

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

async function findLatestGrandPrixMessage(
  channel: Extract<Awaited<ReturnType<typeof client.channels.fetch>>, { type: ChannelType.GuildText }>,
  grandPrixName: string
) {
  const messages = await channel.messages.fetch({ limit: 50 });

  return messages
    .filter((message) => message.author.id === client.user?.id && message.content.includes(grandPrixName))
    .sort((first, second) => second.createdTimestamp - first.createdTimestamp)
    .first();
}

async function cleanupDuplicateGrandPrixMessages(
  channel: Extract<Awaited<ReturnType<typeof client.channels.fetch>>, { type: ChannelType.GuildText }>,
  grandPrixName: string,
  messageIdToKeep: string
) {
  const messages = await channel.messages.fetch({ limit: 50 });
  const duplicates = messages.filter(
    (message) =>
      message.id !== messageIdToKeep &&
      message.author.id === client.user?.id &&
      message.content.includes(grandPrixName)
  );

  for (const duplicate of duplicates.values()) {
    await duplicate.delete().catch((error: unknown) => {
      console.warn(`Could not delete duplicate GP message ${duplicate.id}.`, error);
    });
  }
}
