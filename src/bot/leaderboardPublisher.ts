import { pathToFileURL } from "node:url";
import { AttachmentBuilder, ChannelType, Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";
import { closeDb } from "../db/client.js";
import { PgDiscordMessageRepository } from "../db/discordMessageRepository.js";
import { PgGrandPrixRepository } from "../db/grandPrixRepository.js";
import { PgScoreRepository, type LeaderboardEntry } from "../db/scoreRepository.js";
import type { GrandPrix } from "../domain/types.js";
import { renderLeaderboardCard, type LeaderboardCardEntry } from "../image/leaderboardCard.js";
import { buildLeaderboardMessage } from "./leaderboardMessage.js";

export class LeaderboardPublisher {
  private readonly discordMessageRepository = new PgDiscordMessageRepository();
  private readonly scoreRepository = new PgScoreRepository();

  constructor(private readonly client: Client) {}

  async publish(grandPrix: GrandPrix): Promise<string> {
    if (!env.DISCORD_RESULTS_CHANNEL_ID) {
      throw new Error("DISCORD_RESULTS_CHANNEL_ID is required to publish leaderboard messages.");
    }

    const channel = await this.client.channels.fetch(env.DISCORD_RESULTS_CHANNEL_ID);

    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error("DISCORD_RESULTS_CHANNEL_ID must target a text channel.");
    }

    const leaderboard = await this.scoreRepository.listGrandPrixLeaderboard(grandPrix.id);

    if (leaderboard.length === 0) {
      throw new Error(`No score found for ${grandPrix.name}.`);
    }

    const payload = buildLeaderboardMessage(grandPrix, leaderboard);
    const image = await buildLeaderboardImage(this.client, grandPrix, leaderboard);
    const storedMessage = await this.discordMessageRepository.getGrandPrixLeaderboardMessage(
      grandPrix.id
    );
    const existingMessage = storedMessage
      ? await channel.messages.fetch(storedMessage.messageId).catch(() => undefined)
      : undefined;

    if (existingMessage) {
      const message = await existingMessage.edit({
        ...payload,
        files: image ? [image] : [],
        attachments: []
      });
      return message.url;
    }

    const message = await channel.send({
      ...payload,
      files: image ? [image] : []
    });

    await this.discordMessageRepository.saveGrandPrixLeaderboardMessage({
      grandPrixId: grandPrix.id,
      channelId: channel.id,
      messageId: message.id
    });

    return message.url;
  }
}

async function buildLeaderboardImage(client: Client, grandPrix: GrandPrix, leaderboard: LeaderboardEntry[]) {
  try {
    const leaderboardWithAvatars = await attachDiscordAvatars(client, leaderboard);
    const buffer = await renderLeaderboardCard({ grandPrix, leaderboard: leaderboardWithAvatars });
    return new AttachmentBuilder(buffer, {
      name: `classement-${grandPrix.id}.png`
    });
  } catch (error) {
    console.warn("Could not render leaderboard image, falling back to text leaderboard.", error);
    return undefined;
  }
}

async function attachDiscordAvatars(
  client: Client,
  leaderboard: LeaderboardEntry[]
): Promise<LeaderboardCardEntry[]> {
  return Promise.all(
    leaderboard.map(async (entry) => ({
      ...entry,
      avatarDataUri: await fetchDiscordAvatarDataUri(client, entry.discordUserId)
    }))
  );
}

async function fetchDiscordAvatarDataUri(client: Client, discordUserId: string) {
  try {
    const user = await client.users.fetch(discordUserId);
    const avatarUrl = user.displayAvatarURL({ extension: "png", size: 128 });
    const response = await fetch(avatarUrl);

    if (!response.ok) {
      return undefined;
    }

    const contentType = response.headers.get("content-type") ?? "image/png";
    const avatar = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${avatar.toString("base64")}`;
  } catch (error) {
    console.warn(`Could not fetch Discord avatar for ${discordUserId}.`, error);
    return undefined;
  }
}

async function runOnceFromCli() {
  const grandPrixId = process.argv[2];

  if (!grandPrixId) {
    throw new Error("Usage: npm run publish:leaderboard -- <grandPrixId>");
  }

  if (!env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN is required to publish leaderboard messages.");
  }

  const grandPrixRepository = new PgGrandPrixRepository();
  const grandPrix = await grandPrixRepository.get(grandPrixId);

  if (!grandPrix) {
    throw new Error(`Grand Prix introuvable: ${grandPrixId}`);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once(Events.ClientReady, async () => {
    try {
      const publisher = new LeaderboardPublisher(client);
      const messageUrl = await publisher.publish(grandPrix);
      await grandPrixRepository.updateStatus(grandPrix.id, "published");
      console.log(`Leaderboard published: ${messageUrl}`);
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
