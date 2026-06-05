ALTER TABLE "channel_members" ADD COLUMN "last_read_message_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_members" ADD COLUMN "last_read_at" timestamp;