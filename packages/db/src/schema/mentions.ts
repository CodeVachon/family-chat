import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { messages } from "./messages";

export const mentions = pgTable(
    "mentions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        messageId: uuid("message_id")
            .notNull()
            .references(() => messages.id, { onDelete: "cascade" }),
        mentionedUserId: text("mentioned_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
    },
    (table) => [uniqueIndex("mentions_unique").on(table.messageId, table.mentionedUserId)]
);

export type Mention = typeof mentions.$inferSelect;
