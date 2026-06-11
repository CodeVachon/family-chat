import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Application-wide settings. A single row identified by id = "app".
 */
export const appSettings = pgTable("app_settings", {
    id: text("id").primaryKey().default("app"),
    name: text("name").notNull().default("Family Chat"),
    iconUrl: text("icon_url"),
    // Public channels new users auto-join on approval. No per-element FK (an
    // array can't reference one), so consumers prune to existing public channels.
    defaultChannelIds: uuid("default_channel_ids")
        .array()
        .notNull()
        .default(sql`'{}'::uuid[]`),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export type AppSettings = typeof appSettings.$inferSelect;
