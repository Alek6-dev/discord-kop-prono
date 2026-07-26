import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { Client } from "discord.js";
import { asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { LeaderboardPublisher } from "../bot/leaderboardPublisher.js";
import { env } from "../config/env.js";
import { calculatePredictionTrends } from "../domain/predictionTrends.js";
import { formatScoreDetails } from "../domain/scoreFormatting.js";
import type { ScoreDetails } from "../domain/scoring.js";
import { db } from "../db/client.js";
import { PgDriverRepository } from "../db/driverRepository.js";
import { PgGrandPrixRepository } from "../db/grandPrixRepository.js";
import { PgRaceResultRepository } from "../db/raceResultRepository.js";
import { scoreGrandPrix } from "../db/scoreGrandPrix.js";
import {
  discordPlayers,
  grandPrix,
  jobLogs,
  predictions,
  raceResults,
  scores
} from "../db/schema.js";

const app = Fastify({ logger: true });
const grandPrixRepository = new PgGrandPrixRepository();
const driverRepository = new PgDriverRepository();
const raceResultRepository = new PgRaceResultRepository();
let leaderboardPublisher: LeaderboardPublisher | undefined;

const resultBodySchema = z.object({
  qualifyingTop3DriverIds: z.array(z.string().min(1)).length(3),
  raceTop10DriverIds: z.array(z.string().min(1)).length(10),
  raceP11DriverId: z.string().min(1).optional()
});

const loginBodySchema = z.object({
  token: z.string()
});

if (env.NODE_ENV === "production" && !env.ADMIN_TOKEN) {
  throw new Error("ADMIN_TOKEN is required when running the admin in production.");
}

app.addHook("onRequest", async (request, reply) => {
  if (!env.ADMIN_TOKEN || isPublicAdminPath(request.url)) {
    return;
  }

  if (isAuthorizedAdminRequest(request.headers)) {
    return;
  }

  if (request.headers.accept?.includes("text/html")) {
    reply.redirect("/login");
    return reply;
  }

  reply.code(401).send({ ok: false, error: "Unauthorized" });
  return reply;
});

app.get("/health", async () => ({
  ok: true,
  service: "discord-kop-prono-admin"
}));

app.get("/login", async (_request, reply) => {
  reply.type("text/html; charset=utf-8").send(buildLoginHtml());
});

app.post("/login", async (request, reply) => {
  if (!env.ADMIN_TOKEN) {
    return { ok: true };
  }

  const body = loginBodySchema.parse(request.body);

  if (!tokensMatch(body.token, env.ADMIN_TOKEN)) {
    reply.code(401).send({ ok: false, error: "Token invalide." });
    return;
  }

  reply.header("set-cookie", buildAdminCookie(body.token));
  return { ok: true };
});

app.get("/", async (_request, reply) => {
  reply.type("text/html; charset=utf-8").send(buildAdminHtml());
});

app.get("/api/dashboard", async () => {
  const [gps, drivers, predictionCounts, scoreCounts, resultRows, latestLogs] = await Promise.all([
    grandPrixRepository.list(),
    driverRepository.listActive(),
    db
      .select({ grandPrixId: predictions.grandPrixId, value: count() })
      .from(predictions)
      .groupBy(predictions.grandPrixId),
    db.select({ grandPrixId: scores.grandPrixId, value: count() }).from(scores).groupBy(scores.grandPrixId),
    db.select({ grandPrixId: raceResults.grandPrixId }).from(raceResults),
    db.select().from(jobLogs).orderBy(desc(jobLogs.createdAt)).limit(8)
  ]);

  const predictionCountByGrandPrixId = mapCounts(predictionCounts);
  const scoreCountByGrandPrixId = mapCounts(scoreCounts);
  const resultGrandPrixIds = new Set(resultRows.map((row) => row.grandPrixId));

  return {
    drivers,
    grandPrix: gps.map((gp) => ({
      ...gp,
      predictionCount: predictionCountByGrandPrixId[gp.id] ?? 0,
      scoreCount: scoreCountByGrandPrixId[gp.id] ?? 0,
      hasResult: resultGrandPrixIds.has(gp.id)
    })),
    latestLogs
  };
});

app.get("/api/grand-prix/:grandPrixId", async (request) => {
  const { grandPrixId } = request.params as { grandPrixId: string };
  const [gp, drivers, result, gpPredictions, scoreRows, logs] = await Promise.all([
    grandPrixRepository.get(grandPrixId),
    driverRepository.listActive(),
    raceResultRepository.get(grandPrixId),
    listPredictionsWithPlayers(grandPrixId),
    listScoresWithDetails(grandPrixId),
    db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.grandPrixId, grandPrixId))
      .orderBy(desc(jobLogs.createdAt))
      .limit(10)
  ]);

  if (!gp) {
    const error = new Error(`Grand Prix introuvable: ${grandPrixId}`);
    (error as Error & { statusCode: number }).statusCode = 404;
    throw error;
  }

  const trends = calculatePredictionTrends(
    gpPredictions.map((prediction) => ({
      grandPrixId: prediction.grandPrixId,
      discordUserId: prediction.discordUserId,
      qualifyingTop3DriverIds: prediction.qualifyingTop3DriverIds,
      raceTop10DriverIds: prediction.raceTop10DriverIds
    }))
  );

  return {
    grandPrix: gp,
    drivers,
    result,
    trends,
    predictions: gpPredictions,
    scores: scoreRows.map((score) => ({
      ...score,
      formattedDetails: formatScoreDetails(parseScoreDetails(score.details), drivers)
    })),
    logs
  };
});

app.post("/api/grand-prix/:grandPrixId/results", async (request) => {
  const { grandPrixId } = request.params as { grandPrixId: string };
  const body = resultBodySchema.parse(request.body);

  await raceResultRepository.save({
    grandPrixId,
    qualifyingTop3DriverIds: body.qualifyingTop3DriverIds,
    raceTop10DriverIds: body.raceTop10DriverIds,
    raceP11DriverId: body.raceP11DriverId,
    source: "admin"
  });

  return { ok: true };
});

app.post("/api/grand-prix/:grandPrixId/score", async (request) => {
  const { grandPrixId } = request.params as { grandPrixId: string };
  const result = await scoreGrandPrix(grandPrixId);
  const messageUrl = leaderboardPublisher ? await leaderboardPublisher.publish(result.grandPrix) : undefined;

  if (messageUrl) {
    await grandPrixRepository.updateStatus(grandPrixId, "published");
  }

  return {
    ok: true,
    scoredPredictions: result.scoredPredictions,
    leaderboard: result.leaderboard,
    messageUrl
  };
});

async function listPredictionsWithPlayers(grandPrixId: string) {
  return db
    .select({
      grandPrixId: predictions.grandPrixId,
      discordUserId: predictions.discordUserId,
      discordUsername: discordPlayers.discordUsername,
      qualifyingTop3DriverIds: predictions.qualifyingTop3DriverIds,
      raceTop10DriverIds: predictions.raceTop10DriverIds,
      updatedAt: predictions.updatedAt
    })
    .from(predictions)
    .innerJoin(discordPlayers, eq(predictions.discordUserId, discordPlayers.discordUserId))
    .where(eq(predictions.grandPrixId, grandPrixId))
    .orderBy(asc(discordPlayers.discordUsername));
}

async function listScoresWithDetails(grandPrixId: string) {
  return db
    .select({
      discordUserId: scores.discordUserId,
      discordUsername: discordPlayers.discordUsername,
      points: scores.points,
      details: scores.details,
      calculatedAt: scores.calculatedAt
    })
    .from(scores)
    .innerJoin(discordPlayers, eq(scores.discordUserId, discordPlayers.discordUserId))
    .where(eq(scores.grandPrixId, grandPrixId))
    .orderBy(desc(scores.points), asc(discordPlayers.discordUsername));
}

function parseScoreDetails(details: Record<string, unknown>): ScoreDetails {
  const qualifying = Array.isArray(details.qualifying) ? details.qualifying : [];
  const race = Array.isArray(details.race) ? details.race : [];
  const total = typeof details.total === "number" ? details.total : 0;

  return {
    qualifying: qualifying as ScoreDetails["qualifying"],
    race: race as ScoreDetails["race"],
    total
  };
}

function mapCounts(rows: Array<{ grandPrixId: string; value: number }>) {
  return Object.fromEntries(rows.map((row) => [row.grandPrixId, row.value]));
}

function isPublicAdminPath(url: string) {
  return url === "/health" || url === "/login";
}

function isAuthorizedAdminRequest(headers: Record<string, string | string[] | undefined>) {
  const token = readAdminToken(headers);
  return Boolean(token && env.ADMIN_TOKEN && tokensMatch(token, env.ADMIN_TOKEN));
}

function readAdminToken(headers: Record<string, string | string[] | undefined>) {
  const authorization = firstHeader(headers.authorization);

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const headerToken = firstHeader(headers["x-admin-token"]);

  if (headerToken) {
    return headerToken;
  }

  const cookies = parseCookies(firstHeader(headers.cookie));
  return cookies.admin_token;
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseCookies(cookieHeader?: string) {
  const cookies: Record<string, string> = {};

  for (const part of cookieHeader?.split(";") ?? []) {
    const [name, ...rawValue] = part.trim().split("=");

    if (!name || rawValue.length === 0) {
      continue;
    }

    cookies[name] = decodeURIComponent(rawValue.join("="));
  }

  return cookies;
}

function tokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function buildAdminCookie(token: string) {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `admin_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`;
}

function buildLoginHtml() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KOP Prono Admin - Login</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f4f6f8;
      color: #18202a;
    }
    form {
      display: grid;
      gap: 14px;
      width: min(380px, calc(100vw - 32px));
      padding: 24px;
      border: 1px solid #d9e0e7;
      border-radius: 8px;
      background: #fff;
    }
    h1 { margin: 0; font-size: 20px; }
    label { display: grid; gap: 6px; color: #657282; font-size: 13px; font-weight: 650; }
    input, button {
      min-height: 38px;
      border-radius: 6px;
      border: 1px solid #d9e0e7;
      padding: 8px 10px;
      font: inherit;
    }
    button {
      border-color: #d71920;
      background: #d71920;
      color: #fff;
      font-weight: 750;
      cursor: pointer;
    }
    #status { min-height: 20px; color: #981b1f; font-size: 13px; }
  </style>
</head>
<body>
  <form id="login-form">
    <h1>KOP Prono Admin</h1>
    <label>Token admin
      <input id="token" type="password" autocomplete="current-password" required autofocus />
    </label>
    <button type="submit">Se connecter</button>
    <div id="status"></div>
  </form>
  <script>
    document.getElementById("login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = document.getElementById("status");
      status.textContent = "Connexion...";
      const response = await fetch("/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: document.getElementById("token").value })
      });

      if (!response.ok) {
        status.textContent = "Token invalide.";
        return;
      }

      window.location.href = "/";
    });
  </script>
</body>
</html>`;
}

function buildAdminHtml() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KOP Prono Admin</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f8;
      --panel: #ffffff;
      --text: #18202a;
      --muted: #657282;
      --line: #d9e0e7;
      --accent: #d71920;
      --accent-dark: #981b1f;
      --ok: #177245;
      --warn: #b7791f;
      --locked: #4a5568;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      border-bottom: 1px solid var(--line);
      background: #101820;
      color: #fff;
    }
    h1, h2, h3 { margin: 0; letter-spacing: 0; }
    h1 { font-size: 20px; }
    h2 { font-size: 16px; }
    h3 { font-size: 14px; }
    button {
      border: 1px solid var(--line);
      background: #fff;
      color: var(--text);
      border-radius: 6px;
      padding: 8px 11px;
      cursor: pointer;
      font-weight: 650;
    }
    button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    button:disabled { cursor: not-allowed; opacity: .55; }
    main {
      display: grid;
      grid-template-columns: minmax(280px, 390px) 1fr;
      min-height: calc(100vh - 62px);
    }
    aside {
      border-right: 1px solid var(--line);
      background: #fff;
      overflow: auto;
    }
    .toolbar, .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
    }
    .gp-list { display: grid; gap: 1px; background: var(--line); }
    .gp-item {
      display: grid;
      gap: 6px;
      width: 100%;
      border: 0;
      border-radius: 0;
      padding: 12px 16px;
      text-align: left;
      background: #fff;
    }
    .gp-item.active { box-shadow: inset 4px 0 0 var(--accent); }
    .gp-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .name { font-weight: 750; }
    .meta, .muted { color: var(--muted); font-size: 12px; }
    .badge {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 8px;
      border-radius: 999px;
      font-size: 12px;
      background: #edf2f7;
      color: var(--locked);
      white-space: nowrap;
    }
    .badge.open { background: #e6f6ee; color: var(--ok); }
    .badge.locked { background: #edf2f7; color: var(--locked); }
    .badge.scored, .badge.published { background: #fff4df; color: var(--warn); }
    .content {
      overflow: auto;
      padding: 20px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .panel-body { padding: 14px 16px; }
    .stack { display: grid; gap: 12px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .table th, .table td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    .table th { color: var(--muted); font-size: 11px; text-transform: uppercase; }
    select {
      width: 100%;
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--text);
      padding: 6px 8px;
    }
    .result-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .result-grid.race { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    label { display: grid; gap: 5px; font-size: 12px; font-weight: 650; color: var(--muted); }
    pre {
      margin: 0;
      white-space: pre-wrap;
      overflow: auto;
      max-height: 260px;
      padding: 12px;
      border-radius: 6px;
      background: #101820;
      color: #eaf0f6;
      font-size: 12px;
    }
    .full { grid-column: 1 / -1; }
    .empty { padding: 28px; color: var(--muted); text-align: center; }
    details.score-detail {
      display: grid;
      gap: 10px;
    }
    details.score-detail summary {
      cursor: pointer;
      color: var(--accent-dark);
      font-weight: 750;
    }
    .score-breakdown {
      display: grid;
      gap: 12px;
      margin-top: 10px;
    }
    .score-section {
      display: grid;
      gap: 6px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #f8fafc;
    }
    .score-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-weight: 750;
    }
    .score-lines {
      margin: 0;
      padding-left: 18px;
      color: #2d3748;
    }
    .score-lines li { margin: 4px 0; }
    .status-line {
      min-height: 20px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 650;
    }
    .status-line.ok { color: var(--ok); }
    .status-line.error { color: var(--accent-dark); }
    @media (max-width: 960px) {
      main { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--line); max-height: 45vh; }
      .grid, .result-grid, .result-grid.race { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>KOP Prono Admin</h1>
    <button id="refresh">Actualiser</button>
  </header>
  <main>
    <aside>
      <div class="toolbar">
        <h2>Grands Prix</h2>
        <span id="gp-count" class="muted"></span>
      </div>
      <div id="gp-list" class="gp-list"></div>
    </aside>
    <section class="content">
      <div id="detail" class="empty">Selectionne un Grand Prix.</div>
    </section>
  </main>
  <script>
    const state = {
      dashboard: null,
      selectedGrandPrixId: null,
      detail: null,
      resultStatus: { message: "", kind: "" },
      scoreStatus: { message: "", kind: "" }
    };

    document.getElementById("refresh").addEventListener("click", loadDashboard);

    async function api(path, options) {
      const response = await fetch(path, {
        headers: { "content-type": "application/json" },
        ...options
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      return response.json();
    }

    async function loadDashboard() {
      state.dashboard = await api("/api/dashboard");
      renderGrandPrixList();

      if (!state.selectedGrandPrixId && state.dashboard.grandPrix.length > 0) {
        state.selectedGrandPrixId =
          state.dashboard.grandPrix.find((gp) => gp.status === "open")?.id ?? state.dashboard.grandPrix[0].id;
      }

      if (state.selectedGrandPrixId) {
        await loadGrandPrix(state.selectedGrandPrixId);
      }
    }

    async function loadGrandPrix(grandPrixId) {
      state.selectedGrandPrixId = grandPrixId;
      state.detail = await api("/api/grand-prix/" + encodeURIComponent(grandPrixId));
      renderGrandPrixList();
      renderDetail();
    }

    function renderGrandPrixList() {
      const list = document.getElementById("gp-list");
      document.getElementById("gp-count").textContent = state.dashboard.grandPrix.length + " GP";
      list.innerHTML = state.dashboard.grandPrix.map((gp) => {
        const active = gp.id === state.selectedGrandPrixId ? " active" : "";
        return \`
          <button class="gp-item\${active}" data-gp-id="\${escapeHtml(gp.id)}">
            <span class="gp-title">
              <span class="name">\${escapeHtml(gp.round + ". " + gp.name)}</span>
              <span class="badge \${escapeHtml(gp.status)}">\${escapeHtml(gp.status)}</span>
            </span>
            <span class="meta">\${gp.predictionCount} prono(s) | \${gp.scoreCount} score(s) | resultats \${gp.hasResult ? "OK" : "manquants"}</span>
          </button>
        \`;
      }).join("");

      for (const item of list.querySelectorAll("[data-gp-id]")) {
        item.addEventListener("click", () => loadGrandPrix(item.dataset.gpId));
      }
    }

    function renderDetail() {
      const detail = state.detail;
      const gp = detail.grandPrix;
      const drivers = detail.drivers;
      const driverById = Object.fromEntries(drivers.map((driver) => [driver.id, driver]));

      document.getElementById("detail").innerHTML = \`
        <div class="stack">
          <div class="panel">
            <div class="section-head">
              <div>
                <h2>\${escapeHtml(gp.name)}</h2>
                <div class="muted">Round \${gp.round} | \${escapeHtml(gp.weekendType)} | deadline \${formatDate(gp.predictionsLockAt)}</div>
              </div>
              <span class="badge \${escapeHtml(gp.status)}">\${escapeHtml(gp.status)}</span>
            </div>
          </div>

          <div class="grid">
            <div class="panel">
              <div class="section-head"><h3>Tendances P1</h3></div>
              <div class="panel-body stack">
                \${renderTrend("Pole", detail.trends.pole, driverById)}
                \${renderTrend("Vainqueur", detail.trends.winner, driverById)}
              </div>
            </div>

            <div class="panel">
              <div class="section-head">
                <div>
                  <h3>Scoring</h3>
                  <div id="score-status" class="status-line \${escapeHtml(state.scoreStatus.kind)}">\${escapeHtml(state.scoreStatus.message)}</div>
                </div>
                <button class="primary" id="score-gp" \${detail.result ? "" : "disabled"}>Recalculer + publier</button>
              </div>
              <div class="panel-body">
                <div class="row"><span>Pronos</span><strong>\${detail.predictions.length}</strong></div>
                <div class="row"><span>Scores</span><strong>\${detail.scores.length}</strong></div>
                <div class="row"><span>Resultats</span><strong>\${detail.result ? "disponibles" : "manquants"}</strong></div>
              </div>
            </div>

            <div class="panel full">
              <div class="section-head">
                <div>
                  <h3>Resultat normalise</h3>
                  <div id="result-status" class="status-line \${escapeHtml(state.resultStatus.kind)}">\${escapeHtml(state.resultStatus.message)}</div>
                </div>
                <button class="primary" id="save-result">Enregistrer</button>
              </div>
              <div class="panel-body stack">
                <div class="result-grid">
                  \${[0, 1, 2].map((index) => renderSelect("q" + index, "Q" + (index + 1), drivers, detail.result?.qualifyingTop3DriverIds?.[index])).join("")}
                </div>
                <div class="result-grid race">
                  \${Array.from({ length: 10 }, (_, index) => renderSelect("r" + index, "R" + (index + 1), drivers, detail.result?.raceTop10DriverIds?.[index])).join("")}
                </div>
                <div class="result-grid">
                  \${renderSelect("p11", "P11", drivers, detail.result?.raceP11DriverId)}
                </div>
              </div>
            </div>

            <div class="panel full">
              <div class="section-head"><h3>Classement GP</h3></div>
              \${renderScores(detail.scores, driverById)}
            </div>

            <div class="panel full">
              <div class="section-head"><h3>Pronos</h3></div>
              \${renderPredictions(detail.predictions, driverById)}
            </div>

            <div class="panel full">
              <div class="section-head"><h3>Logs GP</h3></div>
              \${renderLogs(detail.logs)}
            </div>
          </div>
        </div>
      \`;

      document.getElementById("save-result").addEventListener("click", saveResult);
      document.getElementById("score-gp").addEventListener("click", scoreSelectedGrandPrix);
    }

    async function saveResult() {
      const button = document.getElementById("save-result");
      setResultStatus("Enregistrement...", "");
      button.disabled = true;

      const qualifyingTop3DriverIds = [0, 1, 2].map((index) => document.getElementById("q" + index).value);
      const raceTop10DriverIds = Array.from({ length: 10 }, (_, index) => document.getElementById("r" + index).value);
      const raceP11DriverId = document.getElementById("p11").value || undefined;

      try {
        await api("/api/grand-prix/" + encodeURIComponent(state.selectedGrandPrixId) + "/results", {
          method: "POST",
          body: JSON.stringify({ qualifyingTop3DriverIds, raceTop10DriverIds, raceP11DriverId })
        });
        state.resultStatus = { message: "Resultat enregistre.", kind: "ok" };
        await loadGrandPrix(state.selectedGrandPrixId);
      } catch (error) {
        setResultStatus(error.message, "error");
      } finally {
        button.disabled = false;
      }
    }

    async function scoreSelectedGrandPrix() {
      const button = document.getElementById("score-gp");
      setScoreStatus("Calcul en cours...", "");
      button.disabled = true;

      try {
        const result = await api("/api/grand-prix/" + encodeURIComponent(state.selectedGrandPrixId) + "/score", {
          method: "POST",
          body: JSON.stringify({})
        });
        state.scoreStatus = {
          message: result.messageUrl ? "Scores recalcules et classement publie." : "Scores recalcules.",
          kind: "ok"
        };
        await loadDashboard();
      } catch (error) {
        setScoreStatus(error.message, "error");
      } finally {
        button.disabled = false;
      }
    }

    function setResultStatus(message, kind) {
      state.resultStatus = { message, kind };
      setStatusElement("result-status", message, kind);
    }

    function setScoreStatus(message, kind) {
      state.scoreStatus = { message, kind };
      setStatusElement("score-status", message, kind);
    }

    function setStatusElement(id, message, kind) {
      const element = document.getElementById(id);
      if (!element) return;
      element.textContent = message;
      element.className = "status-line" + (kind ? " " + kind : "");
    }

    function renderSelect(id, label, drivers, selectedId) {
      return \`
        <label>\${escapeHtml(label)}
          <select id="\${escapeHtml(id)}">
            <option value="">A selectionner</option>
            \${drivers.map((driver) => \`<option value="\${escapeHtml(driver.id)}" \${driver.id === selectedId ? "selected" : ""}>\${escapeHtml(driver.label)} - \${escapeHtml(driver.team)}</option>\`).join("")}
          </select>
        </label>
      \`;
    }

    function renderTrend(title, trend, driverById) {
      const entries = Object.entries(trend.percentagesByDriverId)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5);

      if (trend.totalPredictions === 0) {
        return \`<div><strong>\${title}</strong><div class="muted">Aucun prono.</div></div>\`;
      }

      return \`
        <div>
          <strong>\${title}</strong>
          <div class="muted">\${trend.totalPredictions} prono(s)</div>
          <table class="table">
            <tbody>
              \${entries.map(([driverId, percentage]) => \`
                <tr><td>\${escapeHtml(driverById[driverId]?.label ?? driverId)}</td><td><strong>\${Math.round(percentage)}%</strong></td></tr>
              \`).join("")}
            </tbody>
          </table>
        </div>
      \`;
    }

    function renderScores(scores, driverById) {
      if (scores.length === 0) {
        return \`<div class="empty">Aucun score calcule.</div>\`;
      }

      return \`
        <table class="table">
          <thead><tr><th>#</th><th>Joueur</th><th>Points</th><th>Details</th></tr></thead>
          <tbody>
            \${scores.map((score, index) => \`
              <tr>
                <td>\${index + 1}</td>
                <td>\${escapeHtml(score.discordUsername)}</td>
                <td><strong>\${Number(score.points).toFixed(2)}</strong></td>
                <td>\${renderScoreDetails(score)}</td>
              </tr>
            \`).join("")}
          </tbody>
        </table>
      \`;
    }

    function renderScoreDetails(score) {
      const formatted = score.formattedDetails;

      return \`
        <details class="score-detail">
          <summary>Voir le detail</summary>
          <div class="score-breakdown">
            \${formatted.sections.map((section) => \`
              <div class="score-section">
                <div class="score-section-head">
                  <span>\${escapeHtml(section.title)}</span>
                  <span>\${formatPoints(section.points)}</span>
                </div>
                \${section.lines.length > 0
                  ? \`<ul class="score-lines">\${section.lines.map((line) => \`<li>\${escapeHtml(line)}</li>\`).join("")}</ul>\`
                  : \`<div class="muted">Aucun point marque.</div>\`
                }
              </div>
            \`).join("")}
            <details>
              <summary>JSON brut</summary>
              <pre>\${escapeHtml(JSON.stringify(score.details, null, 2))}</pre>
            </details>
          </div>
        </details>
      \`;
    }

    function renderPredictions(predictions, driverById) {
      if (predictions.length === 0) {
        return \`<div class="empty">Aucun prono enregistre.</div>\`;
      }

      return \`
        <table class="table">
          <thead><tr><th>Joueur</th><th>Qualifs</th><th>Course</th></tr></thead>
          <tbody>
            \${predictions.map((prediction) => \`
              <tr>
                <td>\${escapeHtml(prediction.discordUsername)}</td>
                <td>\${formatDriverList(prediction.qualifyingTop3DriverIds, driverById)}</td>
                <td>\${formatDriverList(prediction.raceTop10DriverIds, driverById)}</td>
              </tr>
            \`).join("")}
          </tbody>
        </table>
      \`;
    }

    function renderLogs(logs) {
      if (logs.length === 0) {
        return \`<div class="empty">Aucun log pour ce GP.</div>\`;
      }

      return \`
        <table class="table">
          <thead><tr><th>Date</th><th>Job</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>
            \${logs.map((log) => \`
              <tr>
                <td>\${formatDate(log.createdAt)}</td>
                <td>\${escapeHtml(log.jobName)}</td>
                <td>\${escapeHtml(log.status)}</td>
                <td>\${escapeHtml(log.message ?? "")}</td>
              </tr>
            \`).join("")}
          </tbody>
        </table>
      \`;
    }

    function formatDriverList(driverIds, driverById) {
      return driverIds.map((driverId, index) => \`\${index + 1}. \${escapeHtml(driverById[driverId]?.label ?? driverId)}\`).join("<br>");
    }

    function formatDate(value) {
      if (!value) return "-";
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
    }

    function formatPoints(points) {
      const value = Number(points);
      return value.toLocaleString("fr-FR", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2
      }) + " pt" + (value > 1 ? "s" : "");
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    loadDashboard().catch((error) => {
      document.getElementById("detail").innerHTML = "<pre>" + escapeHtml(error.stack ?? error.message) + "</pre>";
    });
  </script>
</body>
</html>`;
}

export async function startAdmin(discordClient?: Client) {
  leaderboardPublisher = discordClient ? new LeaderboardPublisher(discordClient) : undefined;

  await app.listen({
    host: env.ADMIN_HOST,
    port: env.ADMIN_PORT
  });

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await startAdmin();
}
