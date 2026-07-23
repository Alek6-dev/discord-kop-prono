import { env } from "../config/env.js";

if (!env.DISCORD_CLIENT_ID) {
  throw new Error("DISCORD_CLIENT_ID is required to generate the bot invite URL.");
}

const permissions = [
  1024, // View Channels
  2048, // Send Messages
  65536 // Read Message History
].reduce((total, permission) => total + permission, 0);

const inviteUrl = new URL("https://discord.com/oauth2/authorize");

inviteUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
inviteUrl.searchParams.set("permissions", String(permissions));
inviteUrl.searchParams.set("scope", "bot applications.commands");

console.log(inviteUrl.toString());
