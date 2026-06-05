import { relations } from "drizzle-orm";

import { account, session, user } from "./auth";
import { userPreferences } from "./preferences";

export const userRelations = relations(user, ({ one, many }) => ({
    preferences: one(userPreferences, {
        fields: [user.id],
        references: [userPreferences.userId]
    }),
    sessions: many(session),
    accounts: many(account)
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id]
    })
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id]
    })
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
    user: one(user, {
        fields: [userPreferences.userId],
        references: [user.id]
    })
}));
