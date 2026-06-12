ALTER TABLE "user_preferences" ADD COLUMN "daily_digest_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "last_digest_sent_on" text;