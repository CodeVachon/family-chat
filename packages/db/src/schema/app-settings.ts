import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Application-wide settings. A single row identified by id = "app".
 */
export const appSettings = pgTable("app_settings", {
    id: text("id").primaryKey().default("app"),
    name: text("name").notNull().default("Family Chat"),
    iconUrl: text("icon_url"),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export type AppSettings = typeof appSettings.$inferSelect;
