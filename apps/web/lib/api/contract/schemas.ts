import { z } from "zod";

import { REALTIME_EVENT_TYPES } from "@/lib/realtime/event-types";
import { CHANNEL_COLORS, CHANNEL_ICONS, REACTION_EMOJIS } from "@/lib/validation/channel";
import { channelMemberRoleSchema } from "@/lib/validation/channel";
import {
    DATE_TIME_FORMATS,
    FONT_FAMILIES,
    FONT_SIZE_SCALES,
    NOTIFICATION_LEVELS,
    THEME_OPTIONS
} from "@/lib/validation/preferences";

/**
 * The public wire contract for `/api/v1` — the response shapes native clients
 * (e.g. family-chat-cli) can rely on. This is the machine-checked half of
 * `docs/rest-api.md`; `v1.contract.test.ts` parses real route responses (and
 * `fixtures.ts`'s example payloads) against these schemas so a shape change
 * here or in a route handler fails a test instead of silently reaching a
 * client. Widen deliberately (loosen a field, add an optional one) rather than
 * narrow — narrowing is the kind of change docs/rest-api.md's versioning
 * section says needs `/api/v2`.
 */

// All timestamps cross the wire as `Date#toJSON()` ISO-8601 strings — never a
// Date instance — because every response goes through Hono's `context.json()`.
const isoTimestamp = z.string();

export const errorEnvelopeSchema = z.object({
    error: z.object({
        message: z.string(),
        issues: z.array(z.record(z.string(), z.unknown())).optional()
    })
});

export const apiUserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable().optional(),
    appRole: z.enum(["owner", "admin", "user"]),
    approvalStatus: z.enum(["approved", "pending", "rejected"]),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp
});

export const resolvedPreferencesSchema = z.object({
    displayName: z.string().nullable(),
    dateTimeFormat: z.enum(DATE_TIME_FORMATS),
    themePreference: z.enum(THEME_OPTIONS),
    notificationLevel: z.enum(NOTIFICATION_LEVELS),
    colorHue: z.number(),
    fontSizeScale: z.enum(FONT_SIZE_SCALES),
    fontFamily: z.enum(FONT_FAMILIES),
    avatarUrl: z.string().nullable(),
    avatarSourceUrl: z.string().nullable(),
    avatarCrop: z
        .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
        .nullable(),
    bio: z.string().nullable(),
    phone: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    bannerSourceUrl: z.string().nullable(),
    bannerCrop: z
        .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
        .nullable()
});

export const meResponseSchema = z.object({
    user: apiUserSchema,
    preferences: resolvedPreferencesSchema,
    unread: z.number().int().nonnegative()
});

export const channelSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.enum(CHANNEL_COLORS).nullable(),
    icon: z.enum(CHANNEL_ICONS).nullable(),
    isPrivate: z.boolean(),
    isArchived: z.boolean(),
    archivedAt: isoTimestamp.nullable(),
    createdByUserId: z.string(),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp
});

// listVisibleChannels/listChannelActivity decorate the raw row with these —
// present on GET /channels and GET /activity, absent elsewhere (e.g. the
// GET /channels/:id detail response, which returns the raw row instead).
export const visibleChannelSchema = channelSchema.extend({
    myRole: channelMemberRoleSchema.or(z.literal("owner")).nullable(),
    isFavorite: z.boolean(),
    unreadCount: z.number().int().nonnegative(),
    mentionCount: z.number().int().nonnegative()
});

export const channelMembershipSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    userId: z.string(),
    role: channelMemberRoleSchema.or(z.literal("owner")),
    isFavorite: z.boolean(),
    lastReadMessageId: z.string().nullable(),
    lastReadAt: isoTimestamp.nullable(),
    joinedAt: isoTimestamp,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp
});

export const channelCapabilitiesSchema = z.object({
    canPost: z.boolean(),
    canManage: z.boolean(),
    canManageMembers: z.boolean()
});

export const channelDetailResponseSchema = z.object({
    channel: channelSchema,
    membership: channelMembershipSchema.nullable(),
    capabilities: channelCapabilitiesSchema
});

// The flattened shape GET /channels/:id/members returns — not the raw
// channel_members row (see channelMembershipSchema for that, returned only by
// the GET /channels/:id detail endpoint's own `membership` field).
export const channelMemberSchema = z.object({
    userId: z.string(),
    role: channelMemberRoleSchema.or(z.literal("owner")),
    name: z.string(),
    colorHue: z.number(),
    avatarUrl: z.string().nullable()
});

export const reactionSummarySchema = z.object({
    emoji: z.enum(REACTION_EMOJIS as [string, ...string[]]),
    count: z.number().int().positive(),
    reactedByMe: z.boolean()
});

export const mentionSummarySchema = z.object({
    userId: z.string(),
    name: z.string(),
    colorHue: z.number()
});

export const attachmentSchema = z.object({
    id: z.string(),
    messageId: z.string(),
    uploaderId: z.string(),
    kind: z.enum(["image", "pdf", "file", "video"]),
    provider: z.string(),
    publicId: z.string(),
    resourceType: z.string(),
    secureUrl: z.string(),
    format: z.string().nullable(),
    bytes: z.number().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    originalFilename: z.string().nullable(),
    thumbnailUrl: z.string().nullable(),
    createdAt: isoTimestamp
});

export const linkPreviewSchema = z.object({
    id: z.string(),
    url: z.string(),
    status: z.enum(["ok", "failed"]),
    title: z.string().nullable(),
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    siteName: z.string().nullable(),
    cardType: z.string().nullable(),
    faviconUrl: z.string().nullable(),
    fetchedAt: isoTimestamp,
    expiresAt: isoTimestamp.nullable()
});

const messageAuthorSchema = z.object({
    id: z.string(),
    name: z.string(),
    preferences: z
        .object({
            displayName: z.string().nullable(),
            colorHue: z.number(),
            avatarUrl: z.string().nullable()
        })
        .nullable()
});

const systemMessageEventSchema = z.union([
    z.object({
        event: z.enum(["join", "leave"]),
        subjectUserId: z.string(),
        actorUserId: z.string()
    }),
    z.object({
        event: z.literal("channel_updated"),
        actorUserId: z.string(),
        renamedTo: z.string().optional(),
        descriptionChanged: z.boolean().optional()
    })
]);

/**
 * The raw row shape `POST /channels/:id/messages` returns — deliberately NOT
 * the decorated shape below. A sender gets back exactly what it inserted, with
 * no author/attachments/reactions/mentions; those it already knows (it just
 * sent them) and can render optimistically, or pick up from the SSE
 * `message.created` echo / the next history page.
 */
export const sentMessageSchema = z.object({
    id: z.string(),
    channelId: z.string(),
    authorUserId: z.string(),
    type: z.enum(["user", "system"]),
    systemEvent: systemMessageEventSchema.nullable(),
    threadRootId: z.string().nullable(),
    body: z.string(),
    editedAt: isoTimestamp.nullable(),
    deletedAt: isoTimestamp.nullable(),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp
});

/**
 * The decorated shape returned by channel history, thread, and (implicitly)
 * the `message.created`/`message.updated` SSE payload's re-fetch — everything
 * a client needs to render a message without a follow-up request.
 */
export const decoratedMessageSchema = sentMessageSchema.extend({
    author: messageAuthorSchema,
    attachments: z.array(attachmentSchema),
    reactions: z.array(reactionSummarySchema),
    mentions: z.array(mentionSummarySchema),
    mentionsMe: z.boolean(),
    linkPreviews: z.array(linkPreviewSchema)
});

// Top-level channel history additionally carries reply-thread aggregates;
// thread replies (GET .../thread) use decoratedMessageSchema without these.
export const channelMessageSchema = decoratedMessageSchema.extend({
    replyCount: z.number().int().nonnegative(),
    lastReplyAt: isoTimestamp.nullable()
});

export const channelMessagesPageSchema = z.object({
    messages: z.array(channelMessageSchema),
    hasMore: z.boolean()
});

export const threadResponseSchema = z.object({
    messages: z.array(decoratedMessageSchema)
});

export const sendMessageResponseSchema = z.object({
    message: sentMessageSchema
});

export const realtimeEventTypeSchema = z.enum(REALTIME_EVENT_TYPES);

// Loose on purpose: which optional fields are present depends on `type` (see
// docs/rest-api.md's SSE event catalog), and this schema exists to pin the
// type enum and required `ts`, not to fully discriminate every event shape.
export const realtimeEventSchema = z.object({
    type: realtimeEventTypeSchema,
    ts: z.number(),
    channelId: z.string().optional(),
    channelName: z.string().optional(),
    messageId: z.string().optional(),
    actorId: z.string().optional(),
    targetUserId: z.string().optional(),
    userId: z.string().optional(),
    name: z.string().optional(),
    online: z.boolean().optional(),
    onlineUserIds: z.array(z.string()).optional()
});
