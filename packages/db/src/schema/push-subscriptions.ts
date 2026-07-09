import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Web Push subscriptions (one per browser/device). Keyed by the push endpoint;
 * a user may have several across devices.
 */
export const pushSubscriptions = pgTable(
    "push_subscriptions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        endpoint: text("endpoint").notNull().unique(),
        p256dh: text("p256dh").notNull(),
        auth: text("auth").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
    },
    (table) => [index("push_subscriptions_user_idx").on(table.userId)]
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
