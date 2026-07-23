import { ChannelType, Client } from "discord.js";
import { env } from "../config/env.js";
import { PgDiscordMessageRepository } from "../db/discordMessageRepository.js";
import type { GrandPrix } from "../domain/types.js";
import { buildGrandPrixMessage } from "./grandPrixMessage.js";

export class GrandPrixPublisher {
  private readonly discordMessageRepository = new PgDiscordMessageRepository();

  constructor(private readonly client: Client) {}

  async publish(grandPrix: GrandPrix): Promise<string> {
    if (!env.DISCORD_PRONOSTICS_CHANNEL_ID) {
      throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID is required to publish Grand Prix messages.");
    }

    const channel = await this.client.channels.fetch(env.DISCORD_PRONOSTICS_CHANNEL_ID);

    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID must target a text channel.");
    }

    const payload = buildGrandPrixMessage(grandPrix);
    const storedMessage = await this.discordMessageRepository.getGrandPrixMessage(grandPrix.id);
    const existingMessage = storedMessage
      ? await channel.messages.fetch(storedMessage.messageId).catch(() => undefined)
      : undefined;

    if (existingMessage) {
      const message = await existingMessage.edit(payload);
      await this.cleanupDuplicateGrandPrixMessages(channel, grandPrix.name, message.id);
      return message.url;
    }

    const adoptedMessage = await this.findLatestGrandPrixMessage(channel, grandPrix.name);

    if (adoptedMessage) {
      const message = await adoptedMessage.edit(payload);

      await this.discordMessageRepository.saveGrandPrixMessage({
        grandPrixId: grandPrix.id,
        channelId: channel.id,
        messageId: message.id
      });
      await this.cleanupDuplicateGrandPrixMessages(channel, grandPrix.name, message.id);
      return message.url;
    }

    const message = await channel.send(payload);

    await this.discordMessageRepository.saveGrandPrixMessage({
      grandPrixId: grandPrix.id,
      channelId: channel.id,
      messageId: message.id
    });

    return message.url;
  }

  private async findLatestGrandPrixMessage(
    channel: Extract<Awaited<ReturnType<typeof this.client.channels.fetch>>, { type: ChannelType.GuildText }>,
    grandPrixName: string
  ) {
    const messages = await channel.messages.fetch({ limit: 50 });

    return messages
      .filter((message) => message.author.id === this.client.user?.id && message.content.includes(grandPrixName))
      .sort((first, second) => second.createdTimestamp - first.createdTimestamp)
      .first();
  }

  private async cleanupDuplicateGrandPrixMessages(
    channel: Extract<Awaited<ReturnType<typeof this.client.channels.fetch>>, { type: ChannelType.GuildText }>,
    grandPrixName: string,
    messageIdToKeep: string
  ) {
    const messages = await channel.messages.fetch({ limit: 50 });
    const duplicates = messages.filter(
      (message) =>
        message.id !== messageIdToKeep &&
        message.author.id === this.client.user?.id &&
        message.content.includes(grandPrixName)
    );

    for (const duplicate of duplicates.values()) {
      await duplicate.delete().catch((error: unknown) => {
        console.warn(`Could not delete duplicate GP message ${duplicate.id}.`, error);
      });
    }
  }
}
