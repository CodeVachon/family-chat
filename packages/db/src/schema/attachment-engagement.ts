import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { attachments } from "./attachments";
import { user } from "./auth";

/**
 * A "like" on an uploaded attachment — one per (attachment, user). Scoped to the
 * attachment (not its message), so a document carries its own likes wherever
 * it's shown. Cascades when the attachment (or its message) is deleted.
 */
export const attachmentLikes = pgTable(
    "attachment_likes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        attachmentId: uuid("attachment_id")
            .notNull()
            .references(() => attachments.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").notNull().defaultNow()
    },
    (table) => [uniqueIndex("attachment_likes_unique").on(table.attachmentId, table.userId)]
);

export type AttachmentLike = typeof attachmentLikes.$inferSelect;

/** A flat comment on an attachment (soft-deleted like messages, preserving order). */
export const attachmentComments = pgTable(
    "attachment_comments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        attachmentId: uuid("attachment_id")
            .notNull()
            .references(() => attachments.id, { onDelete: "cascade" }),
        authorUserId: text("author_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        body: text("body").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        editedAt: timestamp("edited_at"),
        deletedAt: timestamp("deleted_at")
    },
    (table) => [index("attachment_comments_attachment_idx").on(table.attachmentId, table.createdAt)]
);

export type AttachmentComment = typeof attachmentComments.$inferSelect;
