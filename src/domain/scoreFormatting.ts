import type { ScoreDetails, ScoreRuleDetail } from "./scoring.js";
import type { Driver } from "./types.js";

export type FormattedScoreSection = {
  title: string;
  points: number;
  lines: string[];
};

export type FormattedScoreDetails = {
  total: number;
  sections: FormattedScoreSection[];
};

export function formatScoreDetails(details: ScoreDetails, drivers: Driver[]): FormattedScoreDetails {
  const qualifyingPoints = sumPoints(details.qualifying);
  const racePoints = sumPoints(details.race);

  return {
    total: details.total,
    sections: [
      {
        title: "Qualifs",
        points: qualifyingPoints,
        lines: details.qualifying.map((detail) => formatScoreRuleDetail(detail, drivers))
      },
      {
        title: "Course",
        points: racePoints,
        lines: details.race.map((detail) => formatScoreRuleDetail(detail, drivers))
      }
    ]
  };
}

export function formatScoreRuleDetail(detail: ScoreRuleDetail, drivers: Driver[]) {
  const metadata = detail.metadata ?? {};
  const driverId = typeof metadata.driverId === "string" ? metadata.driverId : undefined;
  const driverLabel = driverId ? formatDriver(driverId, drivers) : undefined;
  const points = formatPoints(detail.points);

  switch (detail.rule) {
    case "qualifying_position_exact":
      return `${points} - ${driverLabel} a la bonne position en qualifs (${formatPosition(metadata.position)})`;
    case "qualifying_in_top3_wrong_position":
      return `${points} - ${driverLabel} dans le top 3 qualif, mais P${metadata.actualPosition} au lieu de P${metadata.predictedPosition}`;
    case "qualifying_position_proximity":
      return `${points} - ${driverLabel} a 1 place d'ecart en qualifs`;
    case "poleman_exact":
      return `${points} - Poleman exact (${driverLabel})`;
    case "poleman_rarity_bonus":
      return `${points} - Bonus rarete pole (${driverLabel}, ${formatPercentage(metadata.percentage)} des pronos)`;
    case "qualifying_two_drivers_in_top3":
      return `${points} - 2 pilotes presents dans le top 3 qualif`;
    case "qualifying_top3_unordered":
      return `${points} - Top 3 qualif complet, dans le desordre`;
    case "qualifying_top3_exact":
      return `${points} - Top 3 qualif exact`;
    case "race_position_exact":
      return `${points} - ${driverLabel} a la bonne position en course (${formatPosition(metadata.position)})`;
    case "race_in_top10_wrong_position":
      return `${points} - ${driverLabel} dans le top 10, mais P${metadata.actualPosition} au lieu de P${metadata.predictedPosition}`;
    case "race_position_proximity":
      return `${points} - ${driverLabel} proche de sa position (${metadata.distance} place(s) d'ecart)`;
    case "race_p10_p11_consolation":
      return `${points} - Bonus consolation: ${driverLabel} pronostique P10 termine P11`;
    case "winner_exact":
      return `${points} - Vainqueur exact (${driverLabel})`;
    case "winner_rarity_bonus":
      return `${points} - Bonus rarete vainqueur (${driverLabel}, ${formatPercentage(metadata.percentage)} des pronos)`;
    case "race_podium_unordered":
      return `${points} - Podium complet, dans le desordre`;
    case "race_podium_exact":
      return `${points} - Podium exact`;
    case "race_top10_quantity_bonus":
      return `${points} - ${metadata.presentCount} pilotes presents dans le top 10`;
    case "race_three_consecutive_exact":
      return `${points} - Serie de 3 positions consecutives exactes`;
    case "race_top10_exact":
      return `${points} - Top 10 exact`;
    default:
      return `${points} - ${detail.rule}`;
  }
}

function formatDriver(driverId: string, drivers: Driver[]) {
  return drivers.find((driver) => driver.id === driverId)?.label ?? driverId;
}

function formatPoints(points: number) {
  return `+${points.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(points) ? 0 : 2,
    maximumFractionDigits: 2
  })} pt${points > 1 ? "s" : ""}`;
}

function formatPosition(value: unknown) {
  return typeof value === "number" ? `P${value}` : "position inconnue";
}

function formatPercentage(value: unknown) {
  if (typeof value !== "number") {
    return "0%";
  }

  return `${Math.round(value)}%`;
}

function sumPoints(details: ScoreRuleDetail[]) {
  return Math.round(details.reduce((total, detail) => total + detail.points, 0) * 100) / 100;
}
