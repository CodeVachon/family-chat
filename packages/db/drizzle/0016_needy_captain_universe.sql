ALTER TABLE "user_preferences" ADD COLUMN "avatar_source_url" text;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "avatar_crop" jsonb;