CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"uploader_id" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text DEFAULT 'cloudinary' NOT NULL,
	"public_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"secure_url" text NOT NULL,
	"format" text,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"original_filename" text,
	"thumbnail_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"status" text NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"site_name" text,
	"card_type" text,
	"favicon_url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "link_previews_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_message_idx" ON "attachments" USING btree ("message_id");