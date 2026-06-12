CREATE TABLE "attachment_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "attachment_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attachment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachment_comments" ADD CONSTRAINT "attachment_comments_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_comments" ADD CONSTRAINT "attachment_comments_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_likes" ADD CONSTRAINT "attachment_likes_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_likes" ADD CONSTRAINT "attachment_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_comments_attachment_idx" ON "attachment_comments" USING btree ("attachment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attachment_likes_unique" ON "attachment_likes" USING btree ("attachment_id","user_id");