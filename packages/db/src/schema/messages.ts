import {
    type AnyPgColumn,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { channels } from "./channels";
import { messageType } from "./enums";

/**
 * Payload for a `system` message.
 *
 * join/leave: the subject is the user who joined/left (also stored as
 * `authorUserId` so existing author joins keep working); the actor performed the
 * action — equal to the subject for a self join/leave, different when an admin
 * adds or removes someone.
 *
 * channel_updated: the actor changed the channel's name and/or description (the
 * message is authored by the actor). `renamedTo` is the new name when it
 * changed; `descriptionChanged` is set when the description changed.
 */
export type SystemMessageEvent =
    | {
          event: "join" | "leave";
          subjectUserId: string;
          actorUserId: string;
      }
    | {
          event: "channel_updated";
          actorUserId: string;
          renamedTo?: string;
          descriptionChanged?: boolean;
      };

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
        // `user` = authored message; `system` = inline join/leave announcement.
        type: messageType("type").notNull().default("user"),
        // Set only for `system` messages; describes the announced event.
        systemEvent: jsonb("system_event").$type<SystemMessageEvent>(),
        // null = top-level channel message; set = reply belonging to that root's thread.
        threadRootId: uuid("thread_root_id").references((): AnyPgColumn => messages.id, {
            onDelete: "cascade"
        }),
        body: text("body").notNull(),
        editedAt: timestamp("edited_at", { withTimezone: true }),
        // Soft delete: deletedAt set renders a tombstone, body preserved for audit.
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
    },
    (table) => [
        index("messages_channel_created_idx").on(table.channelId, table.createdAt),
        index("messages_thread_idx").on(table.threadRootId, table.createdAt)
    ]
);

export type Message = typeof messages.$inferSelect;
