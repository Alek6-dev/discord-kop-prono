import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
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

type PredictionPage = "qualifying" | "race1" | "race2" | "race3" | "review";

type PredictionDraft = Partial<Record<PredictionField, string>>;
type PredictionComponent = ButtonBuilder | StringSelectMenuBuilder;
type PredictionComponentRow = ActionRowBuilder<PredictionComponent>;
type PredictionPagePayload = {
  content: string;
  components: PredictionComponentRow[];
};

const drafts = new Map<string, PredictionDraft>();
const predictionRepository = new InMemoryPredictionRepository();

const qualifyingFields: PredictionField[] = ["q1", "q2", "q3"];
const raceFields: PredictionField[] = ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"];
const pageFields: Record<PredictionPage, PredictionField[]> = {
  qualifying: qualifyingFields,
  race1: ["r1", "r2", "r3", "r4"],
  race2: ["r5", "r6", "r7", "r8"],
  race3: ["r9", "r10"],
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

const nextPage: Partial<Record<PredictionPage, PredictionPage>> = {
  qualifying: "race1",
  race1: "race2",
  race2: "race3",
  race3: "review"
};

const previousPage: Partial<Record<PredictionPage, PredictionPage>> = {
  race1: "qualifying",
  race2: "race1",
  race3: "race2",
  review: "race3"
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
      ...buildPredictionPage(interaction.user.id, grandPrixId, "qualifying"),
      ephemeral: true
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
      ephemeral: true
    });
    return;
  }

  if (interaction.customId.startsWith("prediction:page:")) {
    await handlePredictionPageButton(interaction);
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

  const [, , grandPrixId, page, field] = interaction.customId.split(":") as [
    string,
    string,
    string,
    PredictionPage,
    PredictionField
  ];
  const key = predictionKey(interaction.user.id, grandPrixId);
  const draft = drafts.get(key) ?? {};

  draft[field] = interaction.values[0];
  drafts.set(key, draft);

  await interaction.update(buildPredictionPage(interaction.user.id, grandPrixId, page));
}

async function handlePredictionPageButton(interaction: ButtonInteraction) {
  const [, , grandPrixId, page] = interaction.customId.split(":") as [
    string,
    string,
    string,
    PredictionPage
  ];

  await interaction.update(buildPredictionPage(interaction.user.id, grandPrixId, page));
}

async function handlePredictionSubmit(interaction: ButtonInteraction) {
  const grandPrixId = interaction.customId.split(":")[2];
  const key = predictionKey(interaction.user.id, grandPrixId);
  const draft = drafts.get(key) ?? {};

  const prediction = draftToPrediction(grandPrixId, interaction.user.id, draft);
  const validation = validatePrediction(prediction, testDrivers);

  if (!validation.ok) {
    await interaction.update({
      ...buildPredictionPage(interaction.user.id, grandPrixId, "review"),
      content: `${formatDraft(draft)}\n\nErreur: ${validation.reason}`
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

function buildPredictionPage(
  discordUserId: string,
  grandPrixId: string,
  page: PredictionPage
): PredictionPagePayload {
  const draft = drafts.get(predictionKey(discordUserId, grandPrixId)) ?? {};
  const rows: PredictionComponentRow[] = pageFields[page].map((field) =>
    buildDriverSelect(grandPrixId, page, field, draft[field])
  );

  rows.push(buildNavigationRow(grandPrixId, page));

  return {
    content: buildPageContent(page, draft),
    components: rows
  };
}

function buildDriverSelect(
  grandPrixId: string,
  page: PredictionPage,
  field: PredictionField,
  selectedDriverId?: string
) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`prediction:select:${grandPrixId}:${page}:${field}`)
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

function buildNavigationRow(grandPrixId: string, page: PredictionPage) {
  const row = new ActionRowBuilder<PredictionComponent>();
  const previous = previousPage[page];
  const next = nextPage[page];

  if (previous) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`prediction:page:${grandPrixId}:${previous}`)
        .setLabel("Retour")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (next) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`prediction:page:${grandPrixId}:${next}`)
        .setLabel("Suite")
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (page === "review") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`prediction:submit:${grandPrixId}`)
        .setLabel("Valider mon prono")
        .setStyle(ButtonStyle.Success)
    );
  }

  return row;
}

function buildPageContent(page: PredictionPage, draft: PredictionDraft) {
  if (page === "qualifying") {
    return `Top 3 des qualifs\n\n${formatFields(qualifyingFields, draft)}`;
  }

  if (page === "race1") {
    return `Top 10 du Grand Prix - positions 1 a 4\n\n${formatFields(pageFields.race1, draft)}`;
  }

  if (page === "race2") {
    return `Top 10 du Grand Prix - positions 5 a 8\n\n${formatFields(pageFields.race2, draft)}`;
  }

  if (page === "race3") {
    return `Top 10 du Grand Prix - positions 9 a 10\n\n${formatFields(pageFields.race3, draft)}`;
  }

  return formatDraft(draft);
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
