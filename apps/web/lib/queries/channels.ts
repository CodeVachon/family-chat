import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@workspace/db/client";
import {
    attachments,
    channelMembers,
    channels,
    linkPreviews,
    mentions,
    messages,
    user,
    userPreferences,
    type MessageReaction
} from "@workspace/db/schema";
import { extractUrls } from "@/lib/messaging/links";
import { htmlToText } from "@/lib/messaging/rich-text";
import type { ChannelRole } from "@/lib/permissions";
import { cache } from "react";

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
          AND m.type <> 'system'
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

    // Favorited channels pin to the top. Non-members (public channels the user
    // hasn't joined) have no membership row, so coalesce their NULL to false —
    // otherwise DESC would sort NULLs first and float them above real favorites.
    const isFavorite = sql<boolean>`COALESCE(${channelMembers.isFavorite}, false)`;

    const rows = await db
        .select({
            channel: channels,
            myRole: channelMembers.role,
            isFavorite,
            unreadCount,
            mentionCount
        })
        .from(channels)
        .leftJoin(
            channelMembers,
            and(eq(channelMembers.channelId, channels.id), eq(channelMembers.userId, userId))
        )
        .where(or(eq(channels.isPrivate, false), isNotNull(channelMembers.userId)))
        .orderBy(desc(isFavorite), asc(channels.name));

    return rows.map((r) => ({
        ...r.channel,
        myRole: (r.myRole as ChannelRole | null) ?? null,
        isFavorite: Boolean(r.isFavorite),
        unreadCount: Number(r.unreadCount ?? 0),
        mentionCount: Number(r.mentionCount ?? 0)
    }));
}

export type VisibleChannel = Awaited<ReturnType<typeof listVisibleChannels>>[number];

/**
 * Total unread messages across every channel the user has joined — the number
 * shown on the installed app's icon badge.
 *
 * Deliberately mirrors the per-channel `unreadCount` in
 * {@link listVisibleChannels} and sums over the same set (memberships only, since
 * non-members get no unread tracking, and archived channels included because the
 * in-app tab badge counts them too). Kept as one aggregate query rather than
 * reusing `listVisibleChannels`, because the service worker asks for this on
 * every push and doesn't need the channel rows.
 */
export async function countUnreadForUser(userId: string): Promise<number> {
    const rows = await db
        .select({
            total: sql<number>`COALESCE(SUM((
                SELECT COUNT(*) FROM ${messages} m
                WHERE m.channel_id = ${channelMembers.channelId}
                  AND m.deleted_at IS NULL
                  AND m.type <> 'system'
                  AND m.author_user_id <> ${userId}
                  AND (${channelMembers.lastReadAt} IS NULL OR m.created_at > ${channelMembers.lastReadAt})
            )), 0)::int`
        })
        .from(channelMembers)
        .where(eq(channelMembers.userId, userId));

    return Number(rows[0]?.total ?? 0);
}

/**
 * The id of the channel the user was most recently active in — the joined
 * `channel_members` row with the greatest `lastReadAt` whose channel still
 * exists and isn't archived. Used to drop the user back into that channel on
 * app entry. Returns null for a new user (or if their last channel was
 * deleted/archived/left).
 */
export async function resolveLastActiveChannelId(userId: string): Promise<string | null> {
    const rows = await db
        .select({ channelId: channelMembers.channelId })
        .from(channelMembers)
        .innerJoin(channels, eq(channels.id, channelMembers.channelId))
        .where(
            and(
                eq(channelMembers.userId, userId),
                isNotNull(channelMembers.lastReadAt),
                eq(channels.isArchived, false)
            )
        )
        .orderBy(desc(channelMembers.lastReadAt))
        .limit(1);
    return rows[0]?.channelId ?? null;
}

export type ActivityPreview = {
    id: string;
    snippet: string;
    createdAt: Date;
    authorName: string;
    authorHue: number;
};

export type ChannelActivity = VisibleChannel & {
    lastMessageAt: Date | null;
    previews: ActivityPreview[];
};

/** Max characters of a preview snippet shown in the activity feed. */
const PREVIEW_SNIPPET_LENGTH = 140;

/**
 * The recent-activity feed: the user's visible, non-archived channels ordered
 * by latest message time (channels with no messages last), each with up to
 * `perChannel` most-recent message previews (chronological). Previews exclude
 * system and deleted messages and thread replies; privacy is enforced by
 * {@link listVisibleChannels} (private channels the user can't see never
 * appear).
 */
export async function listChannelActivity(
    userId: string,
    opts: { perChannel?: number; maxChannels?: number } = {}
): Promise<ChannelActivity[]> {
    const perChannel = opts.perChannel ?? 3;
    const maxChannels = opts.maxChannels ?? 20;

    const visible = (await listVisibleChannels(userId)).filter((c) => !c.isArchived);
    if (visible.length === 0) return [];
    const ids = visible.map((c) => c.id);

    // Latest `perChannel` top-level, non-system, non-deleted messages per
    // channel, via a row-number window so it's a single round-trip.
    const rows = (await db.execute(sql`
        SELECT id, channel_id, body, created_at, author_name, author_hue
        FROM (
            SELECT m.id,
                   m.channel_id,
                   m.body,
                   m.created_at,
                   COALESCE(${userPreferences.displayName}, ${user.name}) AS author_name,
                   COALESCE(${userPreferences.colorHue}, 220) AS author_hue,
                   ROW_NUMBER() OVER (
                       PARTITION BY m.channel_id
                       ORDER BY m.created_at DESC, m.id DESC
                   ) AS rn
            FROM ${messages} m
            JOIN ${user} ON ${user.id} = m.author_user_id
            LEFT JOIN ${userPreferences} ON ${userPreferences.userId} = m.author_user_id
            WHERE m.channel_id IN (${sql.join(
                ids.map((id) => sql`${id}`),
                sql`, `
            )})
              AND m.deleted_at IS NULL
              AND m.thread_root_id IS NULL
              AND m.type <> 'system'
        ) ranked
        WHERE ranked.rn <= ${perChannel}
        ORDER BY created_at ASC
    `)) as unknown as Array<{
        id: string;
        channel_id: string;
        body: string;
        created_at: Date;
        author_name: string;
        author_hue: number;
    }>;

    // Bucket previews per channel (rows arrive oldest→newest, the display order).
    const byChannel = new Map<string, ActivityPreview[]>();
    for (const r of rows) {
        const list = byChannel.get(r.channel_id) ?? [];
        list.push({
            id: r.id,
            snippet: htmlToText(r.body).slice(0, PREVIEW_SNIPPET_LENGTH),
            createdAt: new Date(r.created_at),
            authorName: r.author_name,
            authorHue: Number(r.author_hue)
        });
        byChannel.set(r.channel_id, list);
    }

    return visible
        .map((channel) => {
            const previews = byChannel.get(channel.id) ?? [];
            const last = previews[previews.length - 1];
            return { ...channel, previews, lastMessageAt: last ? last.createdAt : null };
        })
        .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
        .slice(0, maxChannels);
}

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

/**
 * The batched form of {@link listVisibleChannelIds}, for the realtime broker's
 * fan-out re-resolve — which needs every connected user at once and previously
 * paid one round-trip each.
 *
 * Two queries regardless of how many users are asked about: every user sees the
 * same public channels, so those are fetched once and shared, and only
 * private-channel membership is per-user. Expressed as the same rule as the
 * single-user version (public channels, plus private ones you belong to) so the
 * two cannot drift.
 *
 * Every requested user appears in the result, with an empty array when they can
 * see nothing — the caller has to tell "resolved to nothing" apart from "wasn't
 * asked about".
 */
export async function listVisibleChannelIdsForUsers(
    userIds: string[]
): Promise<Map<string, string[]>> {
    const unique = [...new Set(userIds)].filter(Boolean);
    const byUser = new Map<string, string[]>();
    if (unique.length === 0) return byUser;

    const [publicRows, privateMemberRows] = await Promise.all([
        db.select({ id: channels.id }).from(channels).where(eq(channels.isPrivate, false)),
        db
            .select({ userId: channelMembers.userId, channelId: channelMembers.channelId })
            .from(channelMembers)
            .innerJoin(channels, eq(channels.id, channelMembers.channelId))
            .where(and(inArray(channelMembers.userId, unique), eq(channels.isPrivate, true)))
    ]);

    const publicIds = publicRows.map((r) => r.id);
    for (const userId of unique) byUser.set(userId, [...publicIds]);
    for (const row of privateMemberRows) byUser.get(row.userId)?.push(row.channelId);

    return byUser;
}

export async function getChannel(channelId: string) {
    return db.query.channels.findFirst({ where: eq(channels.id, channelId) });
}

/**
 * Public, non-archived channels for admin pickers (e.g. choosing default
 * auto-join channels). Private channels are intentionally excluded so they can
 * never be configured as defaults.
 */
export async function listPublicChannels() {
    return db.query.channels.findMany({
        where: and(eq(channels.isPrivate, false), eq(channels.isArchived, false)),
        orderBy: asc(channels.name),
        columns: { id: true, name: true, icon: true, color: true }
    });
}

export type PublicChannel = Awaited<ReturnType<typeof listPublicChannels>>[number];

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
    // System announcements have no thread; a hand-crafted ?thread=<systemId> URL
    // must not open one (it would render as an empty-body normal message).
    if (rows.length === 1 && rows[0]!.type === "system") return [];
    return decorateMessages(rows, userId);
}

export type ThreadMessage = Awaited<ReturnType<typeof listThreadMessages>>[number];

/** Memoized per request: the channel layout (for the header) and the channel page
 * (for the composer's mention list) both need this, and neither should pay twice. */
export const listChannelMembers = cache(async (channelId: string) => {
    return db.query.channelMembers.findMany({
        where: eq(channelMembers.channelId, channelId),
        orderBy: asc(channelMembers.joinedAt),
        with: { user: authorWith }
    });
});

export type ChannelMemberWithUser = Awaited<ReturnType<typeof listChannelMembers>>[number];

/**
 * Flatten member rows into the shape the UI renders from, resolving the display
 * name and identity-color fallbacks once. Shared by the channel layout (header,
 * member avatars) and the channel page (the composer's mention list), which would
 * otherwise each carry their own copy of these fallbacks and could drift.
 */
export function toChannelMembers(rows: ChannelMemberWithUser[]) {
    return rows.map((m) => ({
        userId: m.userId,
        role: m.role,
        name: m.user.preferences?.displayName ?? m.user.name,
        colorHue: m.user.preferences?.colorHue ?? 220,
        avatarUrl: m.user.preferences?.avatarUrl ?? null
    }));
}

/** How many images one gallery page returns. */
export const GALLERY_PAGE_SIZE = 60;

/**
 * Every image posted in a channel, oldest first — the channel gallery.
 *
 * Includes thread replies' images (they were shared in the channel) and excludes
 * soft-deleted messages, so a tombstoned post's photos disappear from the gallery
 * too. `kind` is the app's own classification, so PDFs and other files are
 * filtered out here rather than by guessing at the mime type.
 *
 * Paginated by offset rather than a keyset cursor, deliberately. Attachments
 * inserted in one transaction share an identical `created_at` (Postgres `now()` is
 * transaction-start time), so a multi-image post is a block of rows a cursor
 * cannot split — a `createdAt > cursor` page boundary landing inside such a block
 * would return it forever. Offsets are safe in this direction because the sort is
 * ascending and new images only ever append past the end, so an already-loaded
 * page's offsets never shift.
 */
export async function listChannelImages(
    channelId: string,
    opts: { limit?: number; offset?: number } = {}
) {
    const limit = opts.limit ?? GALLERY_PAGE_SIZE;

    const rows = await db
        .select({
            id: attachments.id,
            secureUrl: attachments.secureUrl,
            width: attachments.width,
            height: attachments.height,
            createdAt: attachments.createdAt,
            messageId: attachments.messageId,
            uploaderId: attachments.uploaderId,
            uploaderName: user.name,
            uploaderDisplayName: userPreferences.displayName,
            uploaderAvatarUrl: userPreferences.avatarUrl,
            uploaderColorHue: userPreferences.colorHue
        })
        .from(attachments)
        .innerJoin(messages, eq(messages.id, attachments.messageId))
        .innerJoin(user, eq(user.id, attachments.uploaderId))
        .leftJoin(userPreferences, eq(userPreferences.userId, attachments.uploaderId))
        .where(
            and(
                eq(messages.channelId, channelId),
                isNull(messages.deletedAt),
                eq(attachments.kind, "image")
            )
        )
        // id breaks ties so a multi-image post's rows keep a stable order between
        // pages — without it the offset window could shuffle and drop an image.
        .orderBy(asc(attachments.createdAt), asc(attachments.id))
        .limit(limit)
        .offset(opts.offset ?? 0);

    return rows.map((r) => ({
        id: r.id,
        secureUrl: r.secureUrl,
        width: r.width,
        height: r.height,
        // Serialized here rather than at each boundary: this crosses to the client
        // from both the gallery page and its "load more" action, and a single
        // representation keeps those two paths from disagreeing. The grid formats
        // it in the viewer's own locale and timezone.
        createdAt: r.createdAt.toISOString(),
        messageId: r.messageId,
        uploader: {
            id: r.uploaderId,
            name: r.uploaderDisplayName ?? r.uploaderName,
            avatarUrl: r.uploaderAvatarUrl,
            colorHue: r.uploaderColorHue ?? 220
        }
    }));
}

export type ChannelImage = Awaited<ReturnType<typeof listChannelImages>>[number];

/** How many images the channel gallery holds in total. */
export async function countChannelImages(channelId: string): Promise<number> {
    const rows = await db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(attachments)
        .innerJoin(messages, eq(messages.id, attachments.messageId))
        .where(
            and(
                eq(messages.channelId, channelId),
                isNull(messages.deletedAt),
                eq(attachments.kind, "image")
            )
        );

    return Number(rows[0]?.total ?? 0);
}
