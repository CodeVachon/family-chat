import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { channels } from "./channels";

export const messages = pgTable(
    "messages",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        channelId: uuid("channel_id")
            .notNull()
            .references(() => channels.id, { onDelete: "cascade" }),
        authorUserId: text("author_user_id")
            .notNull()
            .references(() => user.id),
        body: text("body").notNull(),
        editedAt: timestamp("edited_at"),
        // Soft delete: deletedAt set renders a tombstone, body preserved for audit.
        deletedAt: timestamp("deleted_at"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow()
    },
    (table) => [index("messages_channel_created_idx").on(table.channelId, table.createdAt)]
);

export type Message = typeof messages.$inferSelect;
