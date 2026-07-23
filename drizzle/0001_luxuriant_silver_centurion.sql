ALTER TABLE "grand_prix" ADD COLUMN "race_starts_at" timestamp with time zone;--> statement-breakpoint
UPDATE "grand_prix"
SET "race_starts_at" = COALESCE("results_fetch_after_at" - interval '3 hours', "predictions_lock_at");--> statement-breakpoint
ALTER TABLE "grand_prix" ALTER COLUMN "race_starts_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "grand_prix" ADD COLUMN "qualifying_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "grand_prix" ADD COLUMN "sprint_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "grand_prix" ADD COLUMN "sprint_qualifying_starts_at" timestamp with time zone;
