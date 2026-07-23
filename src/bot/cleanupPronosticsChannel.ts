import { ChannelType, Client, Events, GatewayIntentBits, type Message } from "discord.js";
import { env } from "../config/env.js";
import { PgDiscordMessageRepository } from "../db/discordMessageRepository.js";
import { PgGrandPrixRepository } from "../db/grandPrixRepository.js";

const grandPrixRepository = new PgGrandPrixRepository();
const discordMessageRepository = new PgDiscordMessageRepository();

async function main() {
  if (!env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN is required to clean the pronostics channel.");
  }

  if (!env.DISCORD_PRONOSTICS_CHANNEL_ID) {
    throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID is required to clean the pronostics channel.");
  }

  const pronosticsChannelId = env.DISCORD_PRONOSTICS_CHANNEL_ID;
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async () => {
    try {
      const openGrandPrix = await grandPrixRepository.getOpen();

      if (!openGrandPrix) {
        throw new Error("No open Grand Prix found. Run apply:season-state first.");
      }

      const storedMessage = await discordMessageRepository.getGrandPrixMessage(openGrandPrix.id);

      if (!storedMessage) {
        throw new Error(`No Discord message stored for ${openGrandPrix.id}. Run post:gp first.`);
      }

      const channel = await client.channels.fetch(pronosticsChannelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID must target a text channel.");
      }

      const messages = await channel.messages.fetch({ limit: 100 });
      let deletedCount = 0;

      for (const message of messages.values()) {
        if (message.id === storedMessage.messageId) {
          continue;
        }

        if (message.author.id !== client.user?.id || !isPronosticsMessage(message)) {
          continue;
        }

        await message.delete();
        await discordMessageRepository.forgetMessage({
          channelId: channel.id,
          messageId: message.id
        });
        deletedCount += 1;
      }

      console.log(`Kept ${openGrandPrix.name} (${storedMessage.messageId}). Deleted ${deletedCount} old bot message(s).`);
    } finally {
      client.destroy();
      process.exit(0);
    }
  });

  await client.login(env.DISCORD_TOKEN);
}

function isPronosticsMessage(message: Message): boolean {
  return (
    message.content.includes("Grand Prix") ||
    message.content.includes("pronostics") ||
    JSON.stringify(message.components).includes("prediction:")
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
