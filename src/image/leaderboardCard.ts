import sharp from "sharp";
import type { LeaderboardEntry } from "../db/scoreRepository.js";
import type { GrandPrix } from "../domain/types.js";

const CARD_WIDTH = 1600;
const CARD_HEIGHT = 1000;

export type LeaderboardCardEntry = LeaderboardEntry & {
  avatarDataUri?: string;
};

export async function renderLeaderboardCard(input: {
  grandPrix: GrandPrix;
  leaderboard: LeaderboardCardEntry[];
}) {
  const svg = buildLeaderboardSvg(input);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function buildLeaderboardSvg(input: {
  grandPrix: GrandPrix;
  leaderboard: LeaderboardCardEntry[];
}) {
  const podium = input.leaderboard.slice(0, 3);
  const rest = input.leaderboard.slice(3, 10);
  const winner = podium[0];
  const maxPoints = Math.max(...input.leaderboard.map((entry) => entry.points), 0);

  return `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="track-lines" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(16)">
      <rect width="36" height="36" fill="transparent" />
      <rect x="0" y="0" width="2" height="36" fill="#101216" opacity="0.08" />
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="26" stdDeviation="30" flood-color="#101216" flood-opacity="0.16"/>
    </filter>
  </defs>

  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#f6f1e8" />
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#track-lines)" />
  <rect width="${CARD_WIDTH}" height="255" fill="#d71920" />
  <rect width="${CARD_WIDTH}" height="255" fill="url(#track-lines)" opacity="0.35" />

  <text x="68" y="82" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#ffffff">KOP PRONO F1</text>
  <text x="68" y="162" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="900" fill="#ffffff">${escapeXml(fit(input.grandPrix.name, 25))}</text>

  <rect x="1272" y="58" width="260" height="126" fill="#101216" opacity="0.12" stroke="#ffffff" stroke-width="2"/>
  <text x="1510" y="92" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#ffffff">RESULTATS GP</text>
  <text x="1510" y="140" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="900" fill="#ffffff">${input.leaderboard.length}</text>
  <text x="1510" y="162" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#ffffff">JOUEURS</text>

  <g filter="url(#shadow)">
    <rect x="68" y="250" width="682" height="650" fill="#ffffff" opacity="0.94"/>
    <rect x="794" y="250" width="738" height="650" fill="#111418"/>
  </g>

  ${winner ? renderWinner(winner) : ""}
  ${podium.map((entry, index) => renderPodiumRow(entry, index)).join("")}

  <text x="828" y="322" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" fill="#ffffff">Classement</text>
  <text x="1498" y="318" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#aeb3ba">TOP 10</text>
  <line x1="828" y1="344" x2="1498" y2="344" stroke="#ffffff" stroke-opacity="0.18"/>
  ${rest.map((entry, index) => renderLeaderboardRow(entry, index + 4, maxPoints)).join("")}

  <text x="68" y="960" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#737b87">Classement genere automatiquement apres recalcul des scores</text>
  <text x="1532" y="960" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#737b87">discord-kop-prono</text>
</svg>`;
}

function renderWinner(entry: LeaderboardCardEntry) {
  return `<text x="103" y="310" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#d71920">VAINQUEUR PRONO</text>
  <rect x="35" y="296" width="54" height="10" fill="#d71920"/>
  <rect x="116" y="374" width="138" height="134" fill="#d71920"/>
  ${renderAvatar(entry, { x: 104, y: 359, size: 136, initialsSize: 48, borderWidth: 6, borderColor: "#101216", fallbackFill: "#f2c45b" })}
  <text x="270" y="420" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="900" fill="#101216">${escapeXml(fit(entry.discordUsername, 12))}</text>
  <text x="270" y="488" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#d71920">${formatPoints(entry.points)}</text>`;
}

function renderPodiumRow(entry: LeaderboardCardEntry, index: number) {
  const rank = index + 1;
  const y = 550 + index * 114;
  const fill = rank === 1 ? "#f2c45b" : rank === 2 ? "#cbd4df" : "#c98243";
  const textFill = rank === 3 ? "#ffffff" : "#101216";

  return `<rect x="103" y="${y}" width="612" height="94" fill="#ffffff" stroke="#101216" stroke-opacity="0.12"/>
  <circle cx="132" cy="${y + 47}" r="29" fill="${fill}"/>
  <text x="132" y="${y + 57}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900" fill="${textFill}">${rank}</text>
  ${renderAvatar(entry, { x: 177, y: y + 21, size: 52, initialsSize: 18, borderWidth: 2, borderColor: "#ffffff", fallbackFill: "#101216", fallbackTextFill: "#ffffff" })}
  <text x="246" y="${y + 59}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#101216">${escapeXml(fit(entry.discordUsername, 16))}</text>
  <text x="694" y="${y + 59}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900" fill="#101216">${formatPoints(entry.points)}</text>`;
}

function renderLeaderboardRow(entry: LeaderboardCardEntry, rank: number, maxPoints: number) {
  const y = 374 + (rank - 4) * 94;
  const rawWidth = maxPoints > 0 ? Math.max(36, Math.round((entry.points / maxPoints) * 538)) : 0;
  const width = Math.min(rawWidth, 538);

  return `<rect x="828" y="${y}" width="670" height="80" fill="#ffffff" opacity="0.06" stroke="#ffffff" stroke-opacity="0.08"/>
  <text x="846" y="${y + 40}" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#b7bcc3">${rank}</text>
  ${renderAvatar(entry, { x: 880, y: y + 18, size: 44, initialsSize: 15, borderWidth: 2, borderColor: "#2a3036", fallbackFill: "#d71920", fallbackTextFill: "#ffffff" })}
  <text x="942" y="${y + 39}" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900" fill="#ffffff">${escapeXml(fit(entry.discordUsername, 18))}</text>
  <text x="1482" y="${y + 39}" text-anchor="end" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#ffffff">${formatPoints(entry.points)}</text>
  <rect x="942" y="${y + 62}" width="538" height="5" fill="#ffffff" opacity="0.14"/>
  <rect x="942" y="${y + 62}" width="${width}" height="5" fill="#d71920"/>`;
}

function renderAvatar(
  entry: LeaderboardCardEntry,
  input: {
    x: number;
    y: number;
    size: number;
    initialsSize: number;
    borderWidth: number;
    borderColor: string;
    fallbackFill: string;
    fallbackTextFill?: string;
  }
) {
  const center = input.size / 2;
  const radius = center - input.borderWidth;
  const clipId = `avatar-${entry.discordUserId.replace(/[^a-zA-Z0-9_-]/g, "")}-${input.x}-${input.y}`;
  const content = entry.avatarDataUri
    ? `<clipPath id="${clipId}"><circle cx="${input.x + center}" cy="${input.y + center}" r="${radius}"/></clipPath>
  <image href="${entry.avatarDataUri}" x="${input.x}" y="${input.y}" width="${input.size}" height="${input.size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
    : `<circle cx="${input.x + center}" cy="${input.y + center}" r="${radius}" fill="${input.fallbackFill}"/>
  <text x="${input.x + center}" y="${input.y + center + input.initialsSize / 3}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${input.initialsSize}" font-weight="900" fill="${input.fallbackTextFill ?? "#101216"}">${escapeXml(initials(entry.discordUsername))}</text>`;

  return `${content}
  <circle cx="${input.x + center}" cy="${input.y + center}" r="${center - input.borderWidth / 2}" fill="none" stroke="${input.borderColor}" stroke-width="${input.borderWidth}"/>`;
}

function initials(username: string) {
  const normalized = username.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = normalized ? normalized.split(/\s+/) : [username];
  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2) || "?";
}

function formatPoints(points: number) {
  return `${points.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(points) ? 0 : 2,
    maximumFractionDigits: 2
  })} pts`;
}

function fit(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
