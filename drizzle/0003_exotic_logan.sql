ALTER TABLE "scores" ALTER COLUMN "points" SET DATA TYPE numeric(8, 2);--> statement-breakpoint
ALTER TABLE "race_results" ADD COLUMN "race_p11_driver_id" text;