import { ChannelType, Client, GatewayIntentBits, PermissionsBitField } from "discord.js";
import { env } from "../config/env.js";

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to diagnose Discord access.");
}

if (!env.DISCORD_GUILD_ID) {
  throw new Error("DISCORD_GUILD_ID is required to diagnose Discord access.");
}

if (!env.DISCORD_PRONOSTICS_CHANNEL_ID) {
  throw new Error("DISCORD_PRONOSTICS_CHANNEL_ID is required to diagnose Discord access.");
}

const guildId = env.DISCORD_GUILD_ID;
const pronosticsChannelId = env.DISCORD_PRONOSTICS_CHANNEL_ID;

const requiredPermissions = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.ReadMessageHistory
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetchMe();
    const channel = await client.channels.fetch(pronosticsChannelId);

    console.log(`Bot: ${client.user?.tag}`);
    console.log(`Guild: ${guild.name}`);
    console.log(`Bot roles: ${member.roles.cache.map((role) => role.name).join(", ")}`);

    if (!channel) {
      throw new Error("Pronostics channel was not found.");
    }

    console.log(`Channel type: ${ChannelType[channel.type] ?? channel.type}`);

    if (!("permissionsFor" in channel)) {
      throw new Error("Pronostics channel does not expose permissions.");
    }

    const permissions = channel.permissionsFor(member);

    if (!permissions) {
      throw new Error("Could not resolve bot permissions for the pronostics channel.");
    }

    for (const permission of requiredPermissions) {
      console.log(`${permission.toString()} ${permissions.has(permission) ? "ok" : "missing"}`);
    }
  } finally {
    await client.destroy();
  }
});

await client.login(env.DISCORD_TOKEN);
