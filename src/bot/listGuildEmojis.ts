import { Client, Events, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.js";

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to list guild emojis.");
}

if (!env.DISCORD_GUILD_ID) {
  throw new Error("DISCORD_GUILD_ID is required to list guild emojis.");
}

const guildId = env.DISCORD_GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    const emojis = await guild.emojis.fetch();

    if (emojis.size === 0) {
      console.log("No custom emojis found on this guild.");
      return;
    }

    for (const emoji of emojis.values()) {
      console.log(`${emoji.name}=${emoji.id}`);
    }
  } finally {
    await client.destroy();
  }
});

await client.login(env.DISCORD_TOKEN);
