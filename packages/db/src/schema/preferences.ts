import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Per-user preferences (1:1 with `user`). Kept separate from the Better-Auth
 * `user` table so the auth adapter's schema stays clean.
 *
 * `colorHue` (0–360) is the user's identity color; lightness/chroma are clamped
 * per theme in CSS so it stays readable in both light and dark.
 */
export const userPreferences = pgTable("user_preferences", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    dateTimeFormat: text("date_time_format").notNull().default("relative"),
    themePreference: text("theme_preference").notNull().default("system"),
    // 'all' | 'mentions' | 'none'
    notificationLevel: text("notification_level").notNull().default("mentions"),
    colorHue: integer("color_hue").notNull().default(220),
    // Readability prefs. fontSizeScale scales the whole UI (small|default|large|
    // xlarge); fontFamily picks the body typeface from an offered set.
    fontSizeScale: text("font_size_scale").notNull().default("default"),
    fontFamily: text("font_family").notNull().default("figtree"),
    avatarUrl: text("avatar_url"),
    // Public profile fields (shown in the profile side panel).
    bio: text("bio"),
    phone: text("phone"),
    bannerUrl: text("banner_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export type UserPreferences = typeof userPreferences.$inferSelect;
