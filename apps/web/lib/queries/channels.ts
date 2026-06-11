import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@workspace/db/client";
import {
    channelMembers,
    channels,
    linkPreviews,
    mentions,
    messages,
    type MessageReaction
} from "@workspace/db/schema";
import { extractUrls } from "@/lib/messaging/links";
import { htmlToText } from "@/lib/messaging/rich-text";
import type { ChannelRole } from "@/lib/permissions";

const authorWith = {
    columns: { id: true, name: true },
    with: {
        preferences: {
            columns: { displayName: true, colorHue: true, avatarUrl: true }
        }
    }
} as const;

const messageWith = {
    author: authorWith,
    attachments: true,
    reactions: true,
    mentions: { with: { mentionedUser: authorWith } }
} as const;

export type ReactionSummary = { emoji: string; count: number; reactedByMe: boolean };
export type MentionSummary = { userId: string; name: string; colorHue: number };

function aggregateReactions(reactions: MessageReaction[], userId: string): ReactionSummary[] {
    const byEmoji = new Map<string, ReactionSummary>();
    for (const rx of reactions) {
        const entry = byEmoji.get(rx.emoji) ?? { emoji: rx.emoji, count: 0, reactedByMe: false };
        entry.count++;
        if (rx.userId === userId) entry.reactedByMe = true;
        byEmoji.set(rx.emoji, entry);
    }
    return [...byEmoji.values()];
}

/** Single source of the relational message-row shape used by all message lists. */
function queryMessages(where: SQL | undefined, limit?: number) {
    return db.query.messages.findMany({
        where,
        orderBy: asc(messages.createdAt),
        limit,
        with: messageWith
    });
}

type RawMessageRow = Awaited<ReturnType<typeof queryMessages>>[number];

/** Attach link previews, aggregated reactions, and mention summaries to messages. */
async function decorateMessages(rows: RawMessageRow[], userId: string) {
    const urls = [
        ...new Set(rows.flatMap((r) => (r.deletedAt ? [] : extractUrls(htmlToText(r.body)))))
    ];
    const previewByUrl = new Map<string, typeof linkPreviews.$inferSelect>();
    if (urls.length > 0) {
        const previews = await db.query.linkPreviews.findMany({
            where: and(inArray(linkPreviews.url, urls), eq(linkPreviews.status, "ok"))
        });
        for (const p of previews) previewByUrl.set(p.url, p);
    }

    return rows.map((r) => ({
        ...r,
        reactions: aggregateReactions(r.reactions, userId),
        mentions: r.mentions.map(
            (m): MentionSummary => ({
                userId: m.mentionedUserId,
                name: m.mentionedUser.preferences?.displayName ?? m.mentionedUser.name,
                colorHue: m.mentionedUser.preferences?.colorHue ?? 220
            })
        ),
        mentionsMe: r.mentions.some((m) => m.mentionedUserId === userId),
        linkPreviews: r.deletedAt
            ? []
            : extractUrls(htmlToText(r.body))
                  .map((u) => previewByUrl.get(u))
                  .filter((p): p is NonNullable<typeof p> => Boolean(p))
    }));
}

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

    // Of those unread, how many mention the user.
    const mentionCount = sql<number>`CASE WHEN ${channelMembers.userId} IS NULL THEN 0 ELSE (
        SELECT COUNT(*)::int FROM ${messages} m
        JOIN ${mentions} mn ON mn.message_id = m.id
        WHERE m.channel_id = ${channels.id}
          AND m.deleted_at IS NULL
          AND mn.mentioned_user_id = ${userId}
          AND m.author_user_id <> ${userId}
          AND (${channelMembers.lastReadAt} IS NULL OR m.created_at > ${channelMembers.lastReadAt})
    ) END`;

    const rows = await db
        .select({ channel: channels, myRole: channelMembers.role, unreadCount, mentionCount })
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
        unreadCount: Number(r.unreadCount ?? 0),
        mentionCount: Number(r.mentionCount ?? 0)
    }));
}

export type VisibleChannel = Awaited<ReturnType<typeof listVisibleChannels>>[number];

/**
 * Just the IDs of channels visible to a user (public + private they belong to).
 * A cheap variant of {@link listVisibleChannels} without the unread/mention
 * subqueries — used by the realtime broker to (re)resolve SSE fan-out scope.
 */
export async function listVisibleChannelIds(userId: string): Promise<string[]> {
    const rows = await db
        .select({ id: channels.id })
        .from(channels)
        .leftJoin(
            channelMembers,
            and(eq(channelMembers.channelId, channels.id), eq(channelMembers.userId, userId))
        )
        .where(or(eq(channels.isPrivate, false), isNotNull(channelMembers.userId)));
    return rows.map((r) => r.id);
}

export async function getChannel(channelId: string) {
    return db.query.channels.findFirst({ where: eq(channels.id, channelId) });
}

/** How many top-level messages one page (initial load or "load older") returns. */
export const CHANNEL_PAGE_SIZE = 50;

/** A point in the message stream to page backwards from (keyset cursor). */
export type MessageCursor = { id: string; createdAt: Date };

/**
 * Top-level channel messages (no thread replies) in chronological order. Returns
 * the most recent `limit` messages, or — when a `before` cursor is given — the
 * `limit` messages immediately older than it (keyset pagination on
 * createdAt+id), so history is fully navigable rather than capped at one page.
 */
export async function listChannelMessages(
    channelId: string,
    userId: string,
    opts: { limit?: number; before?: MessageCursor } = {}
) {
    const limit = opts.limit ?? CHANNEL_PAGE_SIZE;
    const before = opts.before;

    // Page backwards from the cursor. The cursor's createdAt is a JS Date
    // (millisecond precision) while the column is microsecond precision, so we
    // use an exclusive *next-millisecond* ceiling: this never skips a row that
    // shares the cursor's millisecond but has extra microseconds. It may re-fetch
    // rows already shown in that millisecond — the client dedupes by id — but it
    // can never leave a gap. Fetched newest-first, then reversed to chronological
    // order for display.
    const ceiling = before ? new Date(before.createdAt.getTime() + 1) : null;
    const rows = (
        await db.query.messages.findMany({
            where: and(
                eq(messages.channelId, channelId),
                isNull(messages.threadRootId),
                ceiling ? lt(messages.createdAt, ceiling) : undefined
            ),
            orderBy: [desc(messages.createdAt), desc(messages.id)],
            limit,
            with: messageWith
        })
    ).reverse();

    const decorated = await decorateMessages(rows, userId);

    // Reply counts + last reply time per root message.
    const ids = rows.map((r) => r.id);
    const replyAgg = ids.length
        ? await db
              .select({
                  rootId: messages.threadRootId,
                  count: sql<number>`count(*)::int`,
                  last: sql<string>`max(${messages.createdAt})`
              })
              .from(messages)
              .where(and(inArray(messages.threadRootId, ids), isNull(messages.deletedAt)))
              .groupBy(messages.threadRootId)
        : [];
    const replyByRoot = new Map(replyAgg.map((a) => [a.rootId, a]));

    return decorated.map((d) => {
        const agg = replyByRoot.get(d.id);
        return {
            ...d,
            replyCount: agg?.count ?? 0,
            lastReplyAt: agg?.last ? new Date(agg.last) : null
        };
    });
}

export type ChannelMessage = Awaited<ReturnType<typeof listChannelMessages>>[number];

/** A thread: the root message followed by its replies, chronologically. */
export async function listThreadMessages(rootId: string, userId: string) {
    const rows = await queryMessages(
        or(eq(messages.id, rootId), eq(messages.threadRootId, rootId))
    );
    return decorateMessages(rows, userId);
}

export type ThreadMessage = Awaited<ReturnType<typeof listThreadMessages>>[number];

export async function listChannelMembers(channelId: string) {
    return db.query.channelMembers.findMany({
        where: eq(channelMembers.channelId, channelId),
        orderBy: asc(channelMembers.joinedAt),
        with: { user: authorWith }
    });
}

export type ChannelMemberWithUser = Awaited<ReturnType<typeof listChannelMembers>>[number];
