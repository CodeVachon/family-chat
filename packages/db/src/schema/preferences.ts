import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** A square avatar crop in natural-image pixel coordinates (from the editor). */
export type AvatarCrop = { x: number; y: number; width: number; height: number };

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
    // Delivery URL actually rendered (transform baked in). For a manually
    // cropped avatar this carries the c_crop chain; otherwise the g_auto square.
    avatarUrl: text("avatar_url"),
    // Raw (untransformed) Cloudinary URL of the uploaded image + the manual crop
    // rectangle, kept so the editor can be reopened and the crop re-adjusted
    // non-destructively. Null when the user has no manual crop.
    avatarSourceUrl: text("avatar_source_url"),
    avatarCrop: jsonb("avatar_crop").$type<AvatarCrop>(),
    // Public profile fields (shown in the profile side panel).
    bio: text("bio"),
    phone: text("phone"),
    // Delivery URL actually rendered (transform baked in). For a manually
    // cropped banner this carries the c_crop chain; otherwise the g_auto fill.
    bannerUrl: text("banner_url"),
    // Raw (untransformed) Cloudinary URL + the manual 3:1 crop rectangle, kept
    // so the banner editor can be reopened and re-adjusted non-destructively.
    bannerSourceUrl: text("banner_source_url"),
    bannerCrop: jsonb("banner_crop").$type<AvatarCrop>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export type UserPreferences = typeof userPreferences.$inferSelect;
