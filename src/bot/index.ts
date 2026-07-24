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
import { pathToFileURL } from "node:url";
import { env } from "../config/env.js";
import type { Driver, PredictionInput } from "../domain/types.js";
import { validatePrediction } from "../domain/predictions.js";
import { PgPredictionRepository } from "../db/predictionRepository.js";
import { PgDriverRepository } from "../db/driverRepository.js";
import { PgGrandPrixRepository } from "../db/grandPrixRepository.js";
import { PgScoreRepository } from "../db/scoreRepository.js";
import { assertPredictionsOpen } from "../domain/grandPrixRules.js";
import {
  calculatePredictionTrends,
  MIN_PREDICTIONS_FOR_PUBLIC_TRENDS,
  type PredictionTrends
} from "../domain/predictionTrends.js";
import { buildPrivateScoreMessages } from "./leaderboardMessage.js";

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
const predictionRepository = new PgPredictionRepository();
const driverRepository = new PgDriverRepository();
const grandPrixRepository = new PgGrandPrixRepository();
const scoreRepository = new PgScoreRepository();

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
    const context = await loadPredictionContext(grandPrixId);

    if (!context.availability.ok) {
      await interaction.reply({
        content: context.availability.reason,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({
      ...buildPredictionBlock(
        interaction.user.id,
        grandPrixId,
        "qualifying",
        context.drivers,
        context.trends
      ),
      flags: MessageFlags.Ephemeral
    });
    await interaction.followUp({
      ...buildPredictionBlock(
        interaction.user.id,
        grandPrixId,
        "race_top5",
        context.drivers,
        context.trends
      ),
      flags: MessageFlags.Ephemeral
    });
    await interaction.followUp({
      ...buildPredictionBlock(
        interaction.user.id,
        grandPrixId,
        "race_bottom5",
        context.drivers,
        context.trends
      ),
      flags: MessageFlags.Ephemeral
    });
    await interaction.followUp({
      ...buildPredictionBlock(
        interaction.user.id,
        grandPrixId,
        "review",
        context.drivers,
        context.trends
      ),
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.customId.startsWith("prediction:view:")) {
    const grandPrixId = interaction.customId.split(":")[2];
    const prediction = await predictionRepository.get(interaction.user.id, grandPrixId);
    const predictionMessage = prediction
      ? await formatPrediction(prediction)
      : "Tu n'as pas encore de prono enregistre pour ce Grand Prix.";

    await interaction.reply({
      content: predictionMessage,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.customId.startsWith("prediction:submit:")) {
    await handlePredictionSubmit(interaction);
    return;
  }

  if (interaction.customId.startsWith("score:view:")) {
    await handleScoreView(interaction);
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
  const [drivers, predictions] = await Promise.all([
    driverRepository.listActive(),
    predictionRepository.listByGrandPrix(grandPrixId)
  ]);
  const trends = calculatePredictionTrends(predictions);

  draft[field] = interaction.values[0];
  drafts.set(key, draft);

  await interaction.update(
    buildPredictionBlock(interaction.user.id, grandPrixId, block, drivers, trends)
  );
}

async function handlePredictionSubmit(interaction: ButtonInteraction) {
  const grandPrixId = interaction.customId.split(":")[2];
  const key = predictionKey(interaction.user.id, grandPrixId);
  const draft = drafts.get(key) ?? {};
  const context = await loadPredictionContext(grandPrixId);

  if (!context.availability.ok) {
    await interaction.update({
      content: context.availability.reason,
      components: []
    });
    return;
  }

  const prediction = draftToPrediction(grandPrixId, interaction.user.id, draft);
  const validation = validatePrediction(prediction, context.drivers);

  if (!validation.ok) {
    await interaction.update({
      ...buildPredictionBlock(
        interaction.user.id,
        grandPrixId,
        "review",
        context.drivers,
        context.trends
      ),
      content: `Erreur: ${validation.reason}`
    });
    return;
  }

  await predictionRepository.save({
    prediction,
    discordUsername: interaction.user.username
  });
  drafts.delete(key);

  await interaction.update({
    content: `Ton prono est enregistre.\n\n${await formatPrediction(prediction)}`,
    components: []
  });
}

async function handleScoreView(interaction: ButtonInteraction) {
  const grandPrixId = interaction.customId.split(":")[2];
  const [grandPrix, drivers, leaderboard, score] = await Promise.all([
    grandPrixRepository.get(grandPrixId),
    driverRepository.listActive(),
    scoreRepository.listGrandPrixLeaderboard(grandPrixId),
    scoreRepository.getUserScore(grandPrixId, interaction.user.id)
  ]);

  if (!grandPrix) {
    await interaction.reply({
      content: "Grand Prix introuvable.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (!score) {
    await interaction.reply({
      content: "Aucun score trouve pour toi sur ce Grand Prix.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const scoreMessages = buildPrivateScoreMessages({
    grandPrix,
    leaderboard,
    score,
    drivers
  });

  const [firstMessage, ...followUpMessages] = scoreMessages;

  await interaction.reply({
    content: firstMessage,
    flags: MessageFlags.Ephemeral
  });

  for (const message of followUpMessages) {
    await interaction.followUp({
      content: message,
      flags: MessageFlags.Ephemeral
    });
  }
}

function buildPredictionBlock(
  discordUserId: string,
  grandPrixId: string,
  block: PredictionBlock,
  drivers: Driver[],
  trends: PredictionTrends
): PredictionMessagePayload {
  const draft = drafts.get(predictionKey(discordUserId, grandPrixId)) ?? {};
  const rows: PredictionComponentRow[] = blockFields[block].map((field) =>
    buildDriverSelect(grandPrixId, block, field, drivers, trends, draft[field])
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
  drivers: Driver[],
  trends: PredictionTrends,
  selectedDriverId?: string
) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`prediction:select:${grandPrixId}:${block}:${field}`)
    .setPlaceholder(`${fieldLabels[field]} - a selectionner`)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      drivers.map((driver) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(driver.label)
          .setDescription(buildDriverOptionDescription(driver, field, trends))
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

function buildDriverOptionDescription(driver: Driver, field: PredictionField, trends: PredictionTrends) {
  const base = `${driver.team} - #${driver.number}`;

  if (field === "q1") {
    return `${base} - ${formatTrendDescription(trends.pole, driver.id, "en pole")}`;
  }

  if (field === "r1") {
    return `${base} - ${formatTrendDescription(trends.winner, driver.id, "vainqueur")}`;
  }

  return base;
}

function formatTrendDescription(
  trend: PredictionTrends["pole"],
  driverId: string,
  label: string
) {
  if (trend.totalPredictions < MIN_PREDICTIONS_FOR_PUBLIC_TRENDS) {
    return "tendance indisponible";
  }

  return `${Math.round(trend.percentagesByDriverId[driverId] ?? 0)}% ${label}`;
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
  return fields.map((field) => `${fieldLabels[field]}: ${formatDriverId(draft[field])}`).join("\n");
}

function formatDraft(draft: PredictionDraft) {
  return [
    "Recapitulatif de ton prono",
    "",
    "Qualifs:",
    ...qualifyingFields.map((field) => `${fieldLabels[field]}: ${formatDriverId(draft[field])}`),
    "",
    "Course:",
    ...raceFields.map((field) => `${fieldLabels[field]}: ${formatDriverId(draft[field])}`)
  ].join("\n");
}

async function formatPrediction(prediction: PredictionInput) {
  const drivers = await driverRepository.listActive();

  return [
    "Ton prono",
    "",
    "Qualifs:",
    ...prediction.qualifyingTop3DriverIds.map(
      (driverId, index) => `${index + 1}. ${formatDriverId(driverId, drivers)}`
    ),
    "",
    "Course:",
    ...prediction.raceTop10DriverIds.map(
      (driverId, index) => `${index + 1}. ${formatDriverId(driverId, drivers)}`
    )
  ].join("\n");
}

function formatDriverId(driverId?: string, drivers: Driver[] = []) {
  if (!driverId) {
    return "a selectionner";
  }

  return drivers.find((driver) => driver.id === driverId)?.label ?? driverId;
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

async function loadPredictionContext(grandPrixId: string) {
  const [grandPrix, drivers, predictions] = await Promise.all([
    grandPrixRepository.get(grandPrixId),
    driverRepository.listActive(),
    predictionRepository.listByGrandPrix(grandPrixId)
  ]);

  return {
    grandPrix,
    drivers,
    trends: calculatePredictionTrends(predictions),
    availability: assertPredictionsOpen(grandPrix)
  };
}

export async function startBot() {
  if (!env.DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN is required to start the bot.");
  }

  await client.login(env.DISCORD_TOKEN);
  return client;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await startBot();
}
