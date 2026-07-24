import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { LeaderboardEntry, ScoreEntry } from "../db/scoreRepository.js";
import { formatScoreDetails } from "../domain/scoreFormatting.js";
import type { Driver, GrandPrix } from "../domain/types.js";

export function buildLeaderboardMessage(grandPrix: GrandPrix, leaderboard: LeaderboardEntry[]) {
  const topEntries = leaderboard.slice(0, 10);
  const content = [
    `**Classement - ${grandPrix.name}**`,
    "",
    ...topEntries.map((entry, index) => {
      const rank = leaderboardRank(leaderboard, index);
      return `${rank}. ${entry.discordUsername} - ${formatPoints(entry.points)}`;
    }),
    "",
    `${leaderboard.length} joueur(s) classe(s).`,
    "Clique sur le bouton pour voir ton rang et le detail de ton score."
  ].join("\n");

  return {
    content,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`score:view:${grandPrix.id}`)
          .setLabel("Voir mon score")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

export function buildPrivateScoreMessages(input: {
  grandPrix: GrandPrix;
  leaderboard: LeaderboardEntry[];
  score: ScoreEntry;
  drivers: Driver[];
}) {
  const formatted = formatScoreDetails(input.score.details, input.drivers);
  const scoreIndex = input.leaderboard.findIndex(
    (entry) => entry.discordUserId === input.score.discordUserId
  );

  const summary = [
    `**Ton score - ${input.grandPrix.name}**`,
    "",
    `Total : **${formatPoints(input.score.points)}**`,
    `Classement : **${scoreIndex >= 0 ? leaderboardRank(input.leaderboard, scoreIndex) : "-"} / ${input.leaderboard.length}**`,
    "",
    ...formatted.sections.map((section) => `${section.title} : **${formatPoints(section.points)}**`)
  ].join("\n");

  return [
    summary,
    ...formatted.sections.flatMap((section) =>
      chunkScoreSection(
        `**Detail ${section.title} - ${formatPoints(section.points)}**`,
        section.lines.length > 0 ? section.lines.map((line) => `- ${line}`) : ["- Aucun point marque."]
      )
    )
  ];
}

function chunkScoreSection(title: string, lines: string[]) {
  const messages: string[] = [];
  let current = title;

  for (const line of lines) {
    const next = `${current}\n${line}`;

    if (next.length > 1800) {
      messages.push(current);
      current = `${title}\n${line}`;
      continue;
    }

    current = next;
  }

  messages.push(current);
  return messages;
}

function leaderboardRank(leaderboard: LeaderboardEntry[], index: number) {
  const entry = leaderboard[index];
  const firstSameScoreIndex = leaderboard.findIndex((candidate) => candidate.points === entry.points);
  return firstSameScoreIndex + 1;
}

function formatPoints(points: number) {
  return `${points.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(points) ? 0 : 2,
    maximumFractionDigits: 2
  })} pt${points > 1 ? "s" : ""}`;
}
