import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { messages } from "./messages";

export const messageReactions = pgTable(
    "message_reactions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        messageId: uuid("message_id")
            .notNull()
            .references(() => messages.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        emoji: text("emoji").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow()
    },
    (table) => [
        uniqueIndex("message_reactions_unique").on(table.messageId, table.userId, table.emoji)
    ]
);

export type MessageReaction = typeof messageReactions.$inferSelect;
