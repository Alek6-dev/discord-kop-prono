CREATE TYPE "public"."grand_prix_status" AS ENUM('scheduled', 'open', 'locked', 'awaiting_results', 'scored', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."weekend_type" AS ENUM('normal', 'sprint');--> statement-breakpoint
CREATE TABLE "discord_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"grand_prix_id" text,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_players" (
	"discord_user_id" text PRIMARY KEY NOT NULL,
	"discord_username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"team" text NOT NULL,
	"number" integer NOT NULL,
	"emoji_name" text,
	"emoji_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grand_prix" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"round" integer NOT NULL,
	"weekend_type" "weekend_type" DEFAULT 'normal' NOT NULL,
	"status" "grand_prix_status" DEFAULT 'scheduled' NOT NULL,
	"predictions_open_at" timestamp with time zone,
	"predictions_lock_at" timestamp with time zone NOT NULL,
	"results_fetch_after_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"grand_prix_id" text,
	"status" text NOT NULL,
	"message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"grand_prix_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"qualifying_top3_driver_ids" jsonb NOT NULL,
	"race_top10_driver_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "predictions_grand_prix_id_discord_user_id_pk" PRIMARY KEY("grand_prix_id","discord_user_id")
);
--> statement-breakpoint
CREATE TABLE "race_results" (
	"grand_prix_id" text PRIMARY KEY NOT NULL,
	"qualifying_top3_driver_ids" jsonb NOT NULL,
	"race_top10_driver_ids" jsonb NOT NULL,
	"source" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"grand_prix_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_grand_prix_id_discord_user_id_pk" PRIMARY KEY("grand_prix_id","discord_user_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"year" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_messages" ADD CONSTRAINT "discord_messages_grand_prix_id_grand_prix_id_fk" FOREIGN KEY ("grand_prix_id") REFERENCES "public"."grand_prix"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grand_prix" ADD CONSTRAINT "grand_prix_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_grand_prix_id_grand_prix_id_fk" FOREIGN KEY ("grand_prix_id") REFERENCES "public"."grand_prix"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_grand_prix_id_grand_prix_id_fk" FOREIGN KEY ("grand_prix_id") REFERENCES "public"."grand_prix"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_discord_user_id_discord_players_discord_user_id_fk" FOREIGN KEY ("discord_user_id") REFERENCES "public"."discord_players"("discord_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_grand_prix_id_grand_prix_id_fk" FOREIGN KEY ("grand_prix_id") REFERENCES "public"."grand_prix"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_grand_prix_id_grand_prix_id_fk" FOREIGN KEY ("grand_prix_id") REFERENCES "public"."grand_prix"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_discord_user_id_discord_players_discord_user_id_fk" FOREIGN KEY ("discord_user_id") REFERENCES "public"."discord_players"("discord_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discord_messages_channel_message_idx" ON "discord_messages" USING btree ("channel_id","message_id");