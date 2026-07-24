import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./client.js";
import { discordMessages } from "./schema.js";

export type StoredDiscordMessage = {
  channelId: string;
  messageId: string;
};

export class PgDiscordMessageRepository {
  async getGrandPrixMessage(grandPrixId: string): Promise<StoredDiscordMessage | undefined> {
    const [message] = await db
      .select()
      .from(discordMessages)
      .where(eq(discordMessages.id, grandPrixMessageId(grandPrixId)))
      .limit(1);

    if (!message) {
      return undefined;
    }

    return {
      channelId: message.channelId,
      messageId: message.messageId
    };
  }

  async saveGrandPrixMessage(input: {
    grandPrixId: string;
    channelId: string;
    messageId: string;
  }): Promise<void> {
    await db
      .insert(discordMessages)
      .values({
        id: grandPrixMessageId(input.grandPrixId),
        grandPrixId: input.grandPrixId,
        channelId: input.channelId,
        messageId: input.messageId,
        kind: "grand_prix_main"
      })
      .onConflictDoUpdate({
        target: discordMessages.id,
        set: {
          channelId: input.channelId,
          messageId: input.messageId,
          updatedAt: new Date()
        }
      });
  }

  async getGrandPrixLeaderboardMessage(
    grandPrixId: string
  ): Promise<StoredDiscordMessage | undefined> {
    const [message] = await db
      .select()
      .from(discordMessages)
      .where(eq(discordMessages.id, grandPrixLeaderboardMessageId(grandPrixId)))
      .limit(1);

    if (!message) {
      return undefined;
    }

    return {
      channelId: message.channelId,
      messageId: message.messageId
    };
  }

  async saveGrandPrixLeaderboardMessage(input: {
    grandPrixId: string;
    channelId: string;
    messageId: string;
  }): Promise<void> {
    await db
      .insert(discordMessages)
      .values({
        id: grandPrixLeaderboardMessageId(input.grandPrixId),
        grandPrixId: input.grandPrixId,
        channelId: input.channelId,
        messageId: input.messageId,
        kind: "grand_prix_leaderboard"
      })
      .onConflictDoUpdate({
        target: discordMessages.id,
        set: {
          channelId: input.channelId,
          messageId: input.messageId,
          updatedAt: new Date()
        }
      });
  }

  async rememberAdoptedMessage(input: {
    grandPrixId: string;
    channelId: string;
    messageId: string;
  }): Promise<void> {
    try {
      await this.saveGrandPrixMessage(input);
    } catch {
      await db.insert(discordMessages).values({
        id: randomUUID(),
        grandPrixId: input.grandPrixId,
        channelId: input.channelId,
        messageId: input.messageId,
        kind: "grand_prix_duplicate"
      });
    }
  }

  async forgetMessage(input: { channelId: string; messageId: string }): Promise<void> {
    await db
      .delete(discordMessages)
      .where(
        and(
          eq(discordMessages.channelId, input.channelId),
          eq(discordMessages.messageId, input.messageId)
        )
      );
  }
}

function grandPrixMessageId(grandPrixId: string) {
  return `grand_prix_main:${grandPrixId}`;
}

function grandPrixLeaderboardMessageId(grandPrixId: string) {
  return `grand_prix_leaderboard:${grandPrixId}`;
}
