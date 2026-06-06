import { relations } from "drizzle-orm";

import { attachments } from "./attachments";
import { account, session, user } from "./auth";
import { channelMembers, channels } from "./channels";
import { messages } from "./messages";
import { userPreferences } from "./preferences";

export const userRelations = relations(user, ({ one, many }) => ({
    preferences: one(userPreferences, {
        fields: [user.id],
        references: [userPreferences.userId]
    }),
    sessions: many(session),
    accounts: many(account),
    channelMemberships: many(channelMembers),
    messages: many(messages)
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

export const channelsRelations = relations(channels, ({ one, many }) => ({
    createdBy: one(user, {
        fields: [channels.createdByUserId],
        references: [user.id]
    }),
    members: many(channelMembers),
    messages: many(messages)
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
    channel: one(channels, {
        fields: [channelMembers.channelId],
        references: [channels.id]
    }),
    user: one(user, {
        fields: [channelMembers.userId],
        references: [user.id]
    })
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
    channel: one(channels, {
        fields: [messages.channelId],
        references: [channels.id]
    }),
    author: one(user, {
        fields: [messages.authorUserId],
        references: [user.id]
    }),
    attachments: many(attachments)
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
    message: one(messages, {
        fields: [attachments.messageId],
        references: [messages.id]
    }),
    uploader: one(user, {
        fields: [attachments.uploaderId],
        references: [user.id]
    })
}));
