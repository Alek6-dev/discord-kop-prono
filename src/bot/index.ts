import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits
} from "discord.js";
import { env } from "../config/env.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Discord bot connected as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) {
    return;
  }

  if (interaction.customId.startsWith("prediction:create:")) {
    await interaction.reply({
      content: "Le parcours de pronostic arrive ici: menus pilotes, validation, puis sauvegarde.",
      ephemeral: true
    });
    return;
  }

  if (interaction.customId.startsWith("prediction:view:")) {
    await interaction.reply({
      content: "La consultation de ton prono arrive ici.",
      ephemeral: true
    });
  }
});

export function buildGrandPrixActionRows(grandPrixId: string) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`prediction:create:${grandPrixId}`)
        .setLabel("Faire mon prono")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`prediction:view:${grandPrixId}`)
        .setLabel("Voir mon prono")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to start the bot.");
}

await client.login(env.DISCORD_TOKEN);
