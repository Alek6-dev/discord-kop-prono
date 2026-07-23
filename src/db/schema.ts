import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const weekendTypeEnum = pgEnum("weekend_type", ["normal", "sprint"]);
export const grandPrixStatusEnum = pgEnum("grand_prix_status", [
  "scheduled",
  "open",
  "locked",
  "awaiting_results",
  "scored",
  "published",
  "archived"
]);

export const seasons = pgTable("seasons", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  year: integer("year").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const grandPrix = pgTable("grand_prix", {
  id: text("id").primaryKey(),
  seasonId: text("season_id")
    .notNull()
    .references(() => seasons.id),
  name: text("name").notNull(),
  country: text("country"),
  round: integer("round").notNull(),
  weekendType: weekendTypeEnum("weekend_type").notNull().default("normal"),
  status: grandPrixStatusEnum("status").notNull().default("scheduled"),
  predictionsOpenAt: timestamp("predictions_open_at", { withTimezone: true }),
  predictionsLockAt: timestamp("predictions_lock_at", { withTimezone: true }).notNull(),
  resultsFetchAfterAt: timestamp("results_fetch_after_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const drivers = pgTable("drivers", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  team: text("team").notNull(),
  number: integer("number").notNull(),
  emojiName: text("emoji_name"),
  emojiId: text("emoji_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const discordPlayers = pgTable("discord_players", {
  discordUserId: text("discord_user_id").primaryKey(),
  discordUsername: text("discord_username").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const predictions = pgTable(
  "predictions",
  {
    grandPrixId: text("grand_prix_id")
      .notNull()
      .references(() => grandPrix.id),
    discordUserId: text("discord_user_id")
      .notNull()
      .references(() => discordPlayers.discordUserId),
    polemanDriverId: text("poleman_driver_id")
      .notNull()
      .references(() => drivers.id),
    p1DriverId: text("p1_driver_id")
      .notNull()
      .references(() => drivers.id),
    p2DriverId: text("p2_driver_id")
      .notNull()
      .references(() => drivers.id),
    p3DriverId: text("p3_driver_id")
      .notNull()
      .references(() => drivers.id),
    fastestLapDriverId: text("fastest_lap_driver_id").references(() => drivers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.grandPrixId, table.discordUserId] })
  })
);

export const raceResults = pgTable("race_results", {
  grandPrixId: text("grand_prix_id")
    .primaryKey()
    .references(() => grandPrix.id),
  polemanDriverId: text("poleman_driver_id").references(() => drivers.id),
  raceTop10DriverIds: jsonb("race_top10_driver_ids").$type<string[]>().notNull(),
  fastestLapDriverId: text("fastest_lap_driver_id").references(() => drivers.id),
  source: text("source"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const scores = pgTable(
  "scores",
  {
    grandPrixId: text("grand_prix_id")
      .notNull()
      .references(() => grandPrix.id),
    discordUserId: text("discord_user_id")
      .notNull()
      .references(() => discordPlayers.discordUserId),
    points: integer("points").notNull().default(0),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.grandPrixId, table.discordUserId] })
  })
);

export const discordMessages = pgTable(
  "discord_messages",
  {
    id: text("id").primaryKey(),
    grandPrixId: text("grand_prix_id").references(() => grandPrix.id),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id").notNull(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    messageUniq: uniqueIndex("discord_messages_channel_message_idx").on(
      table.channelId,
      table.messageId
    )
  })
);

export const jobLogs = pgTable("job_logs", {
  id: text("id").primaryKey(),
  jobName: text("job_name").notNull(),
  grandPrixId: text("grand_prix_id").references(() => grandPrix.id),
  status: text("status").notNull(),
  message: text("message"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
