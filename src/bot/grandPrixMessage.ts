import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { TestGrandPrix } from "../domain/grandPrix.js";

export function buildGrandPrixMessage(grandPrix: TestGrandPrix) {
  return {
    content: [
      `**${grandPrix.name}**`,
      "",
      `Pronostics ouverts jusqu'au ${formatDeadline(grandPrix.predictionsLockAt)}.`,
      `Type de week-end : ${grandPrix.weekendType}`,
      "",
      "A pronostiquer :",
      "- Top 3 des qualifications",
      "- Top 10 du Grand Prix"
    ].join("\n"),
    components: buildGrandPrixActionRows(grandPrix.id)
  };
}

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

function formatDeadline(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris"
  }).format(date);
}
