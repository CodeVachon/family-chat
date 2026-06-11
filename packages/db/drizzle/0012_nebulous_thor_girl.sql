CREATE TYPE "public"."message_type" AS ENUM('user', 'system');--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "type" "message_type" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "system_event" jsonb;