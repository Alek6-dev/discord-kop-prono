import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { assertPredictionsOpen } from "../domain/grandPrixRules.js";
import type { GrandPrix } from "../domain/types.js";

export function buildGrandPrixMessage(grandPrix: GrandPrix) {
  const availability = assertPredictionsOpen(grandPrix);

  return {
    content: availability.ok ? buildOpenContent(grandPrix) : buildClosedContent(grandPrix),
    components: buildGrandPrixActionRows(grandPrix.id, availability.ok)
  };
}

export function buildGrandPrixActionRows(grandPrixId: string, canCreatePrediction: boolean) {
  const buttons = [];

  if (canCreatePrediction) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`prediction:create:${grandPrixId}`)
        .setLabel("Faire mon prono")
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`prediction:view:${grandPrixId}`)
      .setLabel("Voir mon prono")
      .setStyle(ButtonStyle.Secondary)
  );

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)
  ];
}

function buildOpenContent(grandPrix: GrandPrix) {
  return [
    `**${grandPrix.name}**`,
    "",
    `Pronostics ouverts jusqu'au ${formatDeadline(grandPrix.predictionsLockAt)}.`,
    `Type de week-end : ${grandPrix.weekendType}`,
    "",
    "A pronostiquer :",
    "- Top 3 des qualifications",
    "- Top 10 du Grand Prix"
  ].join("\n");
}

function buildClosedContent(grandPrix: GrandPrix) {
  return [
    `**${grandPrix.name}**`,
    "",
    "Les pronostics pour ce Grand Prix ne sont plus disponibles.",
    "",
    "Tu peux encore consulter ton prono si tu en as deja enregistre un."
  ].join("\n");
}

function formatDeadline(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris"
  }).format(date);
}
