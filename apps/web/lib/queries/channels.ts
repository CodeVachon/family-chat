import "server-only";

import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channelMembers, channels, messages } from "@workspace/db/schema";
import type { ChannelRole } from "@/lib/permissions";

const authorWith = {
    columns: { id: true, name: true },
    with: {
        preferences: {
            columns: { displayName: true, colorHue: true, avatarUrl: true }
        }
    }
} as const;

/**
 * Channels visible to a user: all public channels, plus private channels they
 * are a member of. Each row carries the user's own role (null if not a member).
 */
export async function listVisibleChannels(userId: string) {
    // Unread = messages by others since the member's read pointer. Only members
    // get unread tracking (0 for public channels they haven't joined).
    const unreadCount = sql<number>`CASE WHEN ${channelMembers.userId} IS NULL THEN 0 ELSE (
        SELECT COUNT(*)::int FROM ${messages} m
        WHERE m.channel_id = ${channels.id}
          AND m.deleted_at IS NULL
          AND m.author_user_id <> ${userId}
          AND (${channelMembers.lastReadAt} IS NULL OR m.created_at > ${channelMembers.lastReadAt})
    ) END`;

    const rows = await db
        .select({ channel: channels, myRole: channelMembers.role, unreadCount })
        .from(channels)
        .leftJoin(
            channelMembers,
            and(eq(channelMembers.channelId, channels.id), eq(channelMembers.userId, userId))
        )
        .where(or(eq(channels.isPrivate, false), isNotNull(channelMembers.userId)))
        .orderBy(asc(channels.name));

    return rows.map((r) => ({
        ...r.channel,
        myRole: (r.myRole as ChannelRole | null) ?? null,
        unreadCount: Number(r.unreadCount ?? 0)
    }));
}

export type VisibleChannel = Awaited<ReturnType<typeof listVisibleChannels>>[number];

export async function getChannel(channelId: string) {
    return db.query.channels.findFirst({ where: eq(channels.id, channelId) });
}

/** Messages for a channel in chronological order (newest at the bottom). */
export async function listChannelMessages(channelId: string, limit = 200) {
    return db.query.messages.findMany({
        where: eq(messages.channelId, channelId),
        orderBy: asc(messages.createdAt),
        limit,
        with: { author: authorWith }
    });
}

export type ChannelMessage = Awaited<ReturnType<typeof listChannelMessages>>[number];

export async function listChannelMembers(channelId: string) {
    return db.query.channelMembers.findMany({
        where: eq(channelMembers.channelId, channelId),
        orderBy: asc(channelMembers.joinedAt),
        with: { user: authorWith }
    });
}

export type ChannelMemberWithUser = Awaited<ReturnType<typeof listChannelMembers>>[number];
