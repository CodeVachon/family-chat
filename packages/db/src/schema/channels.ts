import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { channelRole } from "./enums";

export const channels = pgTable("channels", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    // Stored as a hex color (e.g. "#3b82f6") chosen from a preset palette.
    color: text("color"),
    // lucide icon name (e.g. "hash", "users").
    icon: text("icon"),
    isPrivate: boolean("is_private").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
        .notNull()
        .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const channelMembers = pgTable(
    "channel_members",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        channelId: uuid("channel_id")
            .notNull()
            .references(() => channels.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        role: channelRole("role").notNull().default("user"),
        // Per-user "favorite" flag: favorited channels pin to the top of this
        // user's sidebar. Only members have a row here, so only members can
        // favorite a channel.
        isFavorite: boolean("is_favorite").notNull().default(false),
        // Read pointer for unread counts. No FK (messages is defined later and
        // we don't want a message delete to disturb the pointer).
        lastReadMessageId: uuid("last_read_message_id"),
        lastReadAt: timestamp("last_read_at", { withTimezone: true }),
        joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
    },
    (table) => [
        // One membership per user per channel.
        uniqueIndex("channel_members_channel_user_unique").on(table.channelId, table.userId),
        // "All of this user's memberships" — the unique index above leads with
        // channel_id, and Postgres can't seek a composite index by its second
        // column, so userId-only filters need their own. Used by
        // countUnreadForUser (run on every push) and resolveLastActiveChannelId.
        index("channel_members_user_idx").on(table.userId),
        // Exactly one Owner per channel (partial unique index).
        uniqueIndex("one_channel_owner")
            .on(table.channelId)
            .where(sql`${table.role} = 'owner'`)
    ]
);

export type Channel = typeof channels.$inferSelect;
export type ChannelMember = typeof channelMembers.$inferSelect;
