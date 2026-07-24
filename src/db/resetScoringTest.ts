import { and, eq, like } from "drizzle-orm";
import { ChannelType, Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";
import { closeDb, db } from "./client.js";
import { PgDiscordMessageRepository } from "./discordMessageRepository.js";
import { PgGrandPrixRepository } from "./grandPrixRepository.js";
import { discordMessages, discordPlayers, predictions, raceResults, scores } from "./schema.js";

const grandPrixId = process.argv[2];
const keepDiscordMessage = process.argv.includes("--keep-discord-message");

if (!grandPrixId) {
  throw new Error("Usage: npm run dev:reset-scoring-test -- <grandPrixId>");
}

async function resetScoringTest() {
  const grandPrixRepository = new PgGrandPrixRepository();
  const discordMessageRepository = new PgDiscordMessageRepository();
  const leaderboardMessage = await discordMessageRepository.getGrandPrixLeaderboardMessage(grandPrixId);

  if (leaderboardMessage && !keepDiscordMessage) {
    await deleteDiscordMessage(leaderboardMessage.channelId, leaderboardMessage.messageId);
  }

  await db.delete(scores).where(eq(scores.grandPrixId, grandPrixId));
  await db.delete(raceResults).where(eq(raceResults.grandPrixId, grandPrixId));
  await db
    .delete(predictions)
    .where(and(eq(predictions.grandPrixId, grandPrixId), like(predictions.discordUserId, "bot_prono_%")));
  await db.delete(discordPlayers).where(like(discordPlayers.discordUserId, "bot_prono_%"));
  await db.delete(discordMessages).where(eq(discordMessages.id, `grand_prix_leaderboard:${grandPrixId}`));
  await grandPrixRepository.updateStatus(grandPrixId, "open");

  console.log(`Reset scoring test data for ${grandPrixId}.`);
}

async function deleteDiscordMessage(channelId: string, messageId: string) {
  if (!env.DISCORD_TOKEN) {
    console.warn("DISCORD_TOKEN missing, skipping Discord leaderboard message deletion.");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    await new Promise<void>((resolve, reject) => {
      client.once(Events.ClientReady, () => resolve());
      client.once(Events.Error, reject);
      client.login(env.DISCORD_TOKEN).catch(reject);
    });

    const channel = await client.channels.fetch(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      console.warn(`Could not fetch Discord text channel ${channelId}.`);
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => undefined);

    if (message) {
      await message.delete();
      console.log(`Deleted Discord leaderboard message ${messageId}.`);
    }
  } catch (error) {
    console.warn("Could not delete Discord leaderboard message.", error);
  } finally {
    client.destroy();
  }
}

try {
  await resetScoringTest();
} finally {
  await closeDb();
}
