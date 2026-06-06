import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Cached OpenGraph/Twitter card metadata, keyed by URL. `status` distinguishes
 * a successful fetch from a negative cache entry (so we don't refetch bad URLs).
 */
export const linkPreviews = pgTable("link_previews", {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull().unique(),
    // 'ok' | 'failed'
    status: text("status").notNull(),
    title: text("title"),
    description: text("description"),
    imageUrl: text("image_url"),
    siteName: text("site_name"),
    // 'summary' | 'summary_large_image' | ...
    cardType: text("card_type"),
    faviconUrl: text("favicon_url"),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at")
});

export type LinkPreview = typeof linkPreviews.$inferSelect;
