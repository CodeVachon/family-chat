CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"name" text DEFAULT 'Family Chat' NOT NULL,
	"icon_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
