import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    archivedAt: timestamp("archived_at"),
    createdByUserId: text("created_by_user_id")
        .notNull()
        .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
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
        joinedAt: timestamp("joined_at").notNull().defaultNow(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow()
    },
    (table) => [
        // One membership per user per channel.
        uniqueIndex("channel_members_channel_user_unique").on(table.channelId, table.userId),
        // Exactly one Owner per channel (partial unique index).
        uniqueIndex("one_channel_owner")
            .on(table.channelId)
            .where(sql`${table.role} = 'owner'`)
    ]
);

export type Channel = typeof channels.$inferSelect;
export type ChannelMember = typeof channelMembers.$inferSelect;
