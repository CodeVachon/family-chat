import { sql } from "drizzle-orm";
import {
    type AnyPgColumn,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
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
        // Client-generated idempotency key for POST /api/v1/channels/:id/messages
        // (a native client's own UUID for the compose attempt, not a server id).
        // Null for messages sent through the web app's server action, which has
        // no ambiguous-network-failure retry problem to solve. Never expires —
        // it stays valid for the lifetime of the message row, including after a
        // soft delete, so a retried send after a dropped response always
        // resolves to the one row that attempt already produced.
        clientMessageId: text("client_message_id"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
    },
    (table) => [
        index("messages_channel_created_idx").on(table.channelId, table.createdAt),
        index("messages_thread_idx").on(table.threadRootId, table.createdAt),
        // Scoped per author, not globally: two different users independently
        // generating the same client id is a coincidence they should each be
        // free of, not a conflict between them.
        uniqueIndex("messages_author_client_id_unique")
            .on(table.authorUserId, table.clientMessageId)
            .where(sql`${table.clientMessageId} IS NOT NULL`)
    ]
);

export type Message = typeof messages.$inferSelect;
