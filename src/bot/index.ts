import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from "discord.js";
import { env } from "../config/env.js";
import { testDrivers } from "../domain/drivers.js";
import type { PredictionInput } from "../domain/types.js";
import { validatePrediction } from "../domain/predictions.js";
import { InMemoryPredictionRepository } from "../domain/predictionRepository.js";

type PredictionField =
  | "q1"
  | "q2"
  | "q3"
  | "r1"
  | "r2"
  | "r3"
  | "r4"
  | "r5"
  | "r6"
  | "r7"
  | "r8"
  | "r9"
  | "r10";

type PredictionBlock = "qualifying" | "race_top5" | "race_bottom5" | "review";

type PredictionDraft = Partial<Record<PredictionField, string>>;
type PredictionComponent = ButtonBuilder | StringSelectMenuBuilder;
type PredictionComponentRow = ActionRowBuilder<PredictionComponent>;
type PredictionMessagePayload = {
  content: string;
  components: PredictionComponentRow[];
};

const drafts = new Map<string, PredictionDraft>();
const predictionRepository = new InMemoryPredictionRepository();

const qualifyingFields: PredictionField[] = ["q1", "q2", "q3"];
const raceFields: PredictionField[] = ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"];
const blockFields: Record<PredictionBlock, PredictionField[]> = {
  qualifying: qualifyingFields,
  race_top5: ["r1", "r2", "r3", "r4", "r5"],
  race_bottom5: ["r6", "r7", "r8", "r9", "r10"],
  review: []
};

const fieldLabels: Record<PredictionField, string> = {
  q1: "Qualifs 1er",
  q2: "Qualifs 2e",
  q3: "Qualifs 3e",
  r1: "Course 1er",
  r2: "Course 2e",
  r3: "Course 3e",
  r4: "Course 4e",
  r5: "Course 5e",
  r6: "Course 6e",
  r7: "Course 7e",
  r8: "Course 8e",
  r9: "Course 9e",
  r10: "Course 10e"
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Discord bot connected as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isStringSelectMenu()) {
    await handlePredictionSelect(interaction);
    return;
  }

  if (!interaction.isButton()) {
    return;
  }

  if (interaction.customId.startsWith("prediction:create:")) {
    const grandPrixId = interaction.customId.split(":")[2];
    await interaction.reply({
      ...buildPredictionBlock(interaction.user.id, grandPrixId, "qualifying"),
      flags: MessageFlags.Ephemeral
    });
    await interaction.followUp({
      ...buildPredictionBlock(interaction.user.id, grandPrixId, "race_top5"),
      flags: MessageFlags.Ephemeral
    });
    await interaction.followUp({
      ...buildPredictionBlock(interaction.user.id, grandPrixId, "race_bottom5"),
      flags: MessageFlags.Ephemeral
    });
    await interaction.followUp({
      ...buildPredictionBlock(interaction.user.id, grandPrixId, "review"),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.customId.startsWith("prediction:view:")) {
    const grandPrixId = interaction.customId.split(":")[2];
    const prediction = await predictionRepository.get(interaction.user.id, grandPrixId);

    await interaction.reply({
      content: prediction
        ? formatPrediction(prediction)
        : "Tu n'as pas encore de prono enregistre pour ce Grand Prix.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.customId.startsWith("prediction:submit:")) {
    await handlePredictionSubmit(interaction);
  }
});

async function handlePredictionSelect(interaction: StringSelectMenuInteraction) {
  if (!interaction.customId.startsWith("prediction:select:")) {
    return;
  }

  const [, , grandPrixId, block, field] = interaction.customId.split(":") as [
    string,
    string,
    string,
    PredictionBlock,
    PredictionField
  ];
  const key = predictionKey(interaction.user.id, grandPrixId);
  const draft = drafts.get(key) ?? {};

  draft[field] = interaction.values[0];
  drafts.set(key, draft);

  await interaction.update(buildPredictionBlock(interaction.user.id, grandPrixId, block));
}

async function handlePredictionSubmit(interaction: ButtonInteraction) {
  const grandPrixId = interaction.customId.split(":")[2];
  const key = predictionKey(interaction.user.id, grandPrixId);
  const draft = drafts.get(key) ?? {};

  const prediction = draftToPrediction(grandPrixId, interaction.user.id, draft);
  const validation = validatePrediction(prediction, testDrivers);

  if (!validation.ok) {
    await interaction.update({
      ...buildPredictionBlock(interaction.user.id, grandPrixId, "review"),
      content: `Erreur: ${validation.reason}`
    });
    return;
  }

  await predictionRepository.save(prediction);
  drafts.delete(key);

  await interaction.update({
    content: `Ton prono est enregistre.\n\n${formatPrediction(prediction)}`,
    components: []
  });
}

function buildPredictionBlock(
  discordUserId: string,
  grandPrixId: string,
  block: PredictionBlock
): PredictionMessagePayload {
  const draft = drafts.get(predictionKey(discordUserId, grandPrixId)) ?? {};
  const rows: PredictionComponentRow[] = blockFields[block].map((field) =>
    buildDriverSelect(grandPrixId, block, field, draft[field])
  );

  if (block === "review") {
    rows.push(buildReviewRow(grandPrixId));
  }

  return {
    content: buildBlockContent(block, draft),
    components: rows
  };
}

function buildDriverSelect(
  grandPrixId: string,
  block: PredictionBlock,
  field: PredictionField,
  selectedDriverId?: string
) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`prediction:select:${grandPrixId}:${block}:${field}`)
    .setPlaceholder(`${fieldLabels[field]} - a selectionner`)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      testDrivers.map((driver) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(driver.label)
          .setDescription(`${driver.team} - #${driver.number}`)
          .setValue(driver.id)
          .setDefault(driver.id === selectedDriverId);

        if (driver.emoji) {
          option.setEmoji({ name: driver.emoji.name, id: driver.emoji.id });
        }

        return option;
      })
    );

  return new ActionRowBuilder<PredictionComponent>().addComponents(select);
}

function buildReviewRow(grandPrixId: string) {
  return new ActionRowBuilder<PredictionComponent>().addComponents(
    new ButtonBuilder()
      .setCustomId(`prediction:submit:${grandPrixId}`)
      .setLabel("Valider mon prono")
      .setStyle(ButtonStyle.Success)
  );
}

function buildBlockContent(block: PredictionBlock, draft: PredictionDraft) {
  if (block === "qualifying") {
    return `Top 3 des qualifs\n\n${formatFields(qualifyingFields, draft)}`;
  }

  if (block === "race_top5") {
    return `Top 10 du Grand Prix - positions 1 a 5\n\n${formatFields(blockFields.race_top5, draft)}`;
  }

  if (block === "race_bottom5") {
    return `Top 10 du Grand Prix - positions 6 a 10\n\n${formatFields(blockFields.race_bottom5, draft)}`;
  }

  return "\u200b";
}

function formatFields(fields: PredictionField[], draft: PredictionDraft) {
  return fields.map((field) => `${fieldLabels[field]}: ${formatDriver(draft[field])}`).join("\n");
}

function formatDraft(draft: PredictionDraft) {
  return [
    "Recapitulatif de ton prono",
    "",
    "Qualifs:",
    ...qualifyingFields.map((field) => `${fieldLabels[field]}: ${formatDriver(draft[field])}`),
    "",
    "Course:",
    ...raceFields.map((field) => `${fieldLabels[field]}: ${formatDriver(draft[field])}`)
  ].join("\n");
}

function formatPrediction(prediction: PredictionInput) {
  return [
    "Ton prono",
    "",
    "Qualifs:",
    ...prediction.qualifyingTop3DriverIds.map(
      (driverId, index) => `${index + 1}. ${formatDriver(driverId)}`
    ),
    "",
    "Course:",
    ...prediction.raceTop10DriverIds.map((driverId, index) => `${index + 1}. ${formatDriver(driverId)}`)
  ].join("\n");
}

function formatDriver(driverId?: string) {
  if (!driverId) {
    return "a selectionner";
  }

  return testDrivers.find((driver) => driver.id === driverId)?.label ?? driverId;
}

function draftToPrediction(
  grandPrixId: string,
  discordUserId: string,
  draft: PredictionDraft
): PredictionInput {
  return {
    grandPrixId,
    discordUserId,
    qualifyingTop3DriverIds: qualifyingFields.map((field) => draft[field] ?? ""),
    raceTop10DriverIds: raceFields.map((field) => draft[field] ?? "")
  };
}

function predictionKey(discordUserId: string, grandPrixId: string) {
  return `${discordUserId}:${grandPrixId}`;
}

if (!env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required to start the bot.");
}

await client.login(env.DISCORD_TOKEN);
