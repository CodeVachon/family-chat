import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { messages } from "./messages";

/** Uploaded assets (Cloudinary). Inserted in the same transaction as a message. */
export const attachments = pgTable(
    "attachments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        messageId: uuid("message_id")
            .notNull()
            .references(() => messages.id, { onDelete: "cascade" }),
        uploaderId: text("uploader_id")
            .notNull()
            .references(() => user.id),
        // 'image' | 'pdf' | 'file'
        kind: text("kind").notNull(),
        provider: text("provider").notNull().default("cloudinary"),
        publicId: text("public_id").notNull(),
        // Cloudinary resource type: 'image' | 'raw' | 'video'
        resourceType: text("resource_type").notNull(),
        secureUrl: text("secure_url").notNull(),
        format: text("format"),
        bytes: integer("bytes"),
        width: integer("width"),
        height: integer("height"),
        originalFilename: text("original_filename"),
        thumbnailUrl: text("thumbnail_url"),
        createdAt: timestamp("created_at").notNull().defaultNow()
    },
    (table) => [index("attachments_message_idx").on(table.messageId)]
);

export type Attachment = typeof attachments.$inferSelect;
