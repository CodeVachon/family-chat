import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z, ZodError, type ZodType } from "zod";

import { db } from "@workspace/db/client";
import {
    appSettings,
    attachments,
    channelMembers,
    channels,
    mentions,
    messageReactions,
    messages,
    pushSubscriptions,
    user,
    userPreferences,
    verification
} from "@workspace/db/schema";

import { ApiError, authorizeApiChannel, requireApiUser, type ApiUser } from "@/lib/api/auth";
import { auth } from "@/lib/auth";
import { joinDefaultChannels } from "@/lib/channels/default-channels";
import { isCloudinaryConfigured, isValidAttachmentUrl, signUpload } from "@/lib/cloudinary/server";
import { ensureMessageLinkPreviews } from "@/lib/messaging/link-preview";
import { insertSystemMessage } from "@/lib/messaging/system-messages";
import {
    extractMentionIdsFromHtml,
    htmlToText,
    sanitizeMessageHtml
} from "@/lib/messaging/rich-text";
import { canApp, canInChannel, isAppStaff } from "@/lib/permissions";
import { pushForNewMessage } from "@/lib/push/notify";
import { getBroker } from "@/lib/realtime/broker";
import { createRealtimeStream } from "@/lib/realtime/stream";
import {
    CHANNEL_PAGE_SIZE,
    GALLERY_PAGE_SIZE,
    countChannelImages,
    countUnreadForUser,
    getChannel,
    listChannelActivity,
    listChannelImages,
    listChannelMembers,
    listChannelMessages,
    listPublicChannels,
    listThreadMessages,
    listVisibleChannels,
    toChannelMembers
} from "@/lib/queries/channels";
import { getAppSettings } from "@/lib/queries/app-settings";
import { getUserPreferences } from "@/lib/queries/preferences";
import { getUserProfile } from "@/lib/queries/profile";
import { listApprovedUsers } from "@/lib/queries/users";
import {
    attachmentInputSchema,
    channelFormSchema,
    channelMemberRoleSchema,
    editMessageSchema,
    postMessageSchema,
    REACTION_EMOJIS
} from "@/lib/validation/channel";
import {
    appearancePrefsSchema,
    avatarPrefsSchema,
    bannerPrefsSchema,
    notificationPrefsSchema,
    profilePrefsSchema
} from "@/lib/validation/preferences";

const appSettingsSchema = z.object({
    name: z.string().trim().min(1).max(60),
    iconUrl: z.string().url().nullable(),
    defaultChannelIds: z.array(z.string().uuid()).max(50).default([])
});
const inviteSchema = z.object({
    name: z.string().trim().min(1).max(80),
    email: z.email().transform((value) => value.toLowerCase())
});
const subscriptionSchema = z.object({
    endpoint: z.string().url(),
    p256dh: z.string().min(1),
    auth: z.string().min(1)
});
const idSchema = z.string().uuid();

async function body<S extends ZodType>(request: Request, schema: S): Promise<z.output<S>> {
    let value: unknown;
    try {
        value = await request.json();
    } catch {
        throw new ApiError(400, "Request body must be valid JSON");
    }
    return schema.parse(value);
}

function id(value: string, label = "id"): string {
    const parsed = idSchema.safeParse(value);
    if (!parsed.success) throw new ApiError(400, `Invalid ${label}`);
    return parsed.data;
}

function asOffset(value: string | undefined): number {
    const parsed = Number(value ?? "0");
    if (!Number.isInteger(parsed) || parsed < 0) throw new ApiError(400, "Invalid offset");
    return parsed;
}

async function requireChannel(actor: ApiUser, channelId: string) {
    return authorizeApiChannel(actor, id(channelId, "channel id"), "channel:view");
}

async function memberIdsIn(channelId: string, userIds: string[]): Promise<string[]> {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return [];
    const rows = await db
        .select({ userId: channelMembers.userId })
        .from(channelMembers)
        .where(and(eq(channelMembers.channelId, channelId), inArray(channelMembers.userId, ids)));
    return rows.map((row) => row.userId);
}

async function updatePreferences(
    actor: ApiUser,
    values: Record<string, unknown>,
    syncUsers: boolean
) {
    const set = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined)
    );
    await db
        .insert(userPreferences)
        .values({ userId: actor.id, ...set })
        .onConflictDoUpdate({
            target: userPreferences.userId,
            set: { ...set, updatedAt: new Date() }
        });
    if (syncUsers) getBroker().publishEphemeral({ type: "users.changed", ts: Date.now() });
}

/**
 * Versioned REST contract for browser and native clients. Authentication is
 * supplied by Better Auth's session cookie or bearer plugin; no HTTP handler
 * calls Next's `headers`, `redirect`, or cache APIs.
 */
const api = new Hono().basePath("/api/v1");

api.onError((error, context) => {
    if (error instanceof ApiError) {
        return context.json({ error: { message: error.message } }, error.status as 400);
    }
    if (error instanceof ZodError) {
        return context.json({ error: { message: "Validation failed", issues: error.issues } }, 422);
    }
    console.error("[api] unhandled error", error);
    return context.json({ error: { message: "Internal server error" } }, 500);
});

api.get("/health", (context) => context.json({ ok: true }));

api.get("/me", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const [preferences, unread] = await Promise.all([
        getUserPreferences(actor.id),
        countUnreadForUser(actor.id)
    ]);
    return context.json({ user: actor, preferences, unread });
});

api.get("/settings", async (context) => context.json(await getAppSettings()));

api.get("/vapid-public-key", (context) =>
    context.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null })
);

api.get("/unread", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    return context.json({ total: await countUnreadForUser(actor.id) });
});

api.get("/stream", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    return createRealtimeStream(context.req.raw, actor.id);
});

api.get("/channels", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    return context.json({ channels: await listVisibleChannels(actor.id) });
});

api.get("/activity", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    return context.json({ channels: await listChannelActivity(actor.id) });
});

api.post("/channels", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    if (!canApp(actor, "channel:create")) throw new ApiError(403, "Not authorized");
    const input = await body(context.req.raw, channelFormSchema);
    const channel = await db.transaction(async (tx) => {
        const [created] = await tx
            .insert(channels)
            .values({ ...input, createdByUserId: actor.id })
            .returning();
        if (!created) throw new ApiError(500, "Could not create channel");
        await tx
            .insert(channelMembers)
            .values({ channelId: created.id, userId: actor.id, role: "owner" });
        await insertSystemMessage(tx, {
            channelId: created.id,
            event: "join",
            subjectUserId: actor.id,
            actorUserId: actor.id
        });
        return created;
    });
    return context.json({ channel }, 201);
});

api.get("/channels/public", async (context) => {
    await requireApiUser(context.req.raw.headers);
    return context.json({ channels: await listPublicChannels() });
});

api.get("/channels/:channelId", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    const { channel, membership } = await requireChannel(actor, channelId);
    return context.json({
        channel,
        membership,
        capabilities: {
            canPost: canInChannel(actor, membership, channel, "channel:post"),
            canManage: canInChannel(actor, membership, channel, "channel:edit_settings"),
            canManageMembers: canInChannel(actor, membership, channel, "channel:manage_members")
        }
    });
});

api.patch("/channels/:channelId", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    const { channel } = await authorizeApiChannel(actor, channelId, "channel:edit_settings");
    const input = await body(context.req.raw, channelFormSchema);
    const renamed = input.name !== channel.name;
    const descriptionChanged = input.description !== channel.description;
    const [updated] = await db.transaction(async (tx) => {
        const rows = await tx
            .update(channels)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(channels.id, channelId))
            .returning();
        if (renamed || descriptionChanged) {
            await insertSystemMessage(tx, {
                channelId,
                event: "channel_updated",
                actorUserId: actor.id,
                ...(renamed ? { renamedTo: input.name } : {}),
                ...(descriptionChanged ? { descriptionChanged: true } : {})
            });
        }
        return rows;
    });
    return context.json({ channel: updated });
});

api.patch("/channels/:channelId/archive", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await authorizeApiChannel(actor, channelId, "channel:archive");
    const { archived } = await body(context.req.raw, z.object({ archived: z.boolean() }));
    const [channel] = await db
        .update(channels)
        .set({
            isArchived: archived,
            archivedAt: archived ? new Date() : null,
            updatedAt: new Date()
        })
        .where(eq(channels.id, channelId))
        .returning();
    return context.json({ channel });
});

api.delete("/channels/:channelId", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await authorizeApiChannel(actor, channelId, "channel:delete");
    await db.delete(channels).where(eq(channels.id, channelId));
    return context.body(null, 204);
});

api.post("/channels/:channelId/join", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    const channel = await getChannel(channelId);
    if (!channel) throw new ApiError(404, "Channel not found");
    if (channel.isPrivate) throw new ApiError(403, "Cannot join a private channel");
    await db.transaction(async (tx) => {
        const inserted = await tx
            .insert(channelMembers)
            .values({ channelId, userId: actor.id, role: "user" })
            .onConflictDoNothing()
            .returning({ id: channelMembers.id });
        if (inserted.length) {
            await insertSystemMessage(tx, {
                channelId,
                event: "join",
                subjectUserId: actor.id,
                actorUserId: actor.id
            });
        }
    });
    return context.json({ joined: true });
});

api.post("/channels/:channelId/leave", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    const membership = await db.query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, actor.id))
    });
    if (membership?.role === "owner") throw new ApiError(409, "The channel owner cannot leave");
    await db.transaction(async (tx) => {
        const removed = await tx
            .delete(channelMembers)
            .where(
                and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, actor.id))
            )
            .returning({ id: channelMembers.id });
        if (removed.length)
            await insertSystemMessage(tx, {
                channelId,
                event: "leave",
                subjectUserId: actor.id,
                actorUserId: actor.id
            });
    });
    return context.body(null, 204);
});

api.patch("/channels/:channelId/favorite", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    const { favorite } = await body(context.req.raw, z.object({ favorite: z.boolean() }));
    await db
        .update(channelMembers)
        .set({ isFavorite: favorite, updatedAt: new Date() })
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, actor.id)));
    return context.json({ favorite });
});

api.post("/channels/:channelId/read", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    const latest = await db.query.messages.findFirst({
        where: eq(messages.channelId, channelId),
        orderBy: desc(messages.createdAt),
        columns: { id: true }
    });
    await db
        .update(channelMembers)
        .set({
            lastReadAt: new Date(),
            lastReadMessageId: latest?.id ?? null,
            updatedAt: new Date()
        })
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, actor.id)));
    return context.body(null, 204);
});

api.post("/channels/:channelId/typing", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    const membership = await db.query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, actor.id))
    });
    if (!membership) return context.body(null, 204);
    getBroker().publishEphemeral({
        type: "typing",
        channelId,
        userId: actor.id,
        name: actor.name,
        ts: Date.now()
    });
    return context.body(null, 204);
});

api.get("/channels/:channelId/members", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await requireChannel(actor, channelId);
    return context.json({ members: toChannelMembers(await listChannelMembers(channelId)) });
});

api.get("/channels/:channelId/addable-users", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await authorizeApiChannel(actor, channelId, "channel:manage_members");
    const memberIds = new Set((await listChannelMembers(channelId)).map((member) => member.userId));
    return context.json({
        users: (await listApprovedUsers()).filter((member) => !memberIds.has(member.id))
    });
});

api.post("/channels/:channelId/members", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await authorizeApiChannel(actor, channelId, "channel:manage_members");
    const input = await body(
        context.req.raw,
        z.object({ userId: z.string().min(1), role: channelMemberRoleSchema.default("user") })
    );
    const target = await db.query.user.findFirst({
        where: eq(user.id, input.userId),
        columns: { approvalStatus: true }
    });
    if (!target || target.approvalStatus !== "approved")
        throw new ApiError(422, "User must be approved");
    await db.transaction(async (tx) => {
        const inserted = await tx
            .insert(channelMembers)
            .values({ channelId, userId: input.userId, role: input.role })
            .onConflictDoNothing()
            .returning({ id: channelMembers.id });
        if (inserted.length)
            await insertSystemMessage(tx, {
                channelId,
                event: "join",
                subjectUserId: input.userId,
                actorUserId: actor.id
            });
    });
    return context.json({ added: true }, 201);
});

api.patch("/channels/:channelId/members/:userId", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await authorizeApiChannel(actor, channelId, "channel:manage_members");
    const userId = context.req.param("userId");
    const target = await db.query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)),
        columns: { role: true }
    });
    if (target?.role === "owner") throw new ApiError(409, "Cannot modify the channel owner");
    const { role } = await body(context.req.raw, z.object({ role: channelMemberRoleSchema }));
    await db
        .update(channelMembers)
        .set({ role, updatedAt: new Date() })
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
    return context.json({ role });
});

api.delete("/channels/:channelId/members/:userId", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await authorizeApiChannel(actor, channelId, "channel:manage_members");
    const userId = context.req.param("userId");
    const target = await db.query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)),
        columns: { role: true }
    });
    if (target?.role === "owner") throw new ApiError(409, "Cannot modify the channel owner");
    await db.transaction(async (tx) => {
        const removed = await tx
            .delete(channelMembers)
            .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
            .returning({ id: channelMembers.id });
        if (removed.length)
            await insertSystemMessage(tx, {
                channelId,
                event: "leave",
                subjectUserId: userId,
                actorUserId: actor.id
            });
    });
    return context.body(null, 204);
});

api.get("/channels/:channelId/messages", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await requireChannel(actor, channelId);
    const beforeId = context.req.query("beforeId");
    const beforeCreatedAt = context.req.query("beforeCreatedAt");
    const before =
        beforeId && beforeCreatedAt
            ? { id: id(beforeId, "message id"), createdAt: new Date(beforeCreatedAt) }
            : undefined;
    if (before && Number.isNaN(before.createdAt.valueOf()))
        throw new ApiError(400, "Invalid message cursor");
    const result = await listChannelMessages(channelId, actor.id, { before });
    return context.json({ messages: result, hasMore: result.length >= CHANNEL_PAGE_SIZE });
});

api.post("/channels/:channelId/messages", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await authorizeApiChannel(actor, channelId, "channel:post");
    const input = await body(context.req.raw, postMessageSchema.omit({ channelId: true }));
    const messageInput = { ...input, channelId };
    const content = sanitizeMessageHtml(messageInput.body.trim());
    if (!htmlToText(content).length && !messageInput.attachments.length)
        throw new ApiError(422, "Message cannot be empty");
    for (const attachment of messageInput.attachments) {
        attachmentInputSchema.parse(attachment);
        if (!isValidAttachmentUrl(attachment.secureUrl, attachment.publicId)) {
            throw new ApiError(422, "Invalid attachment");
        }
    }
    if (messageInput.threadRootId) {
        const root = await db.query.messages.findFirst({
            where: eq(messages.id, messageInput.threadRootId),
            columns: { channelId: true, threadRootId: true }
        });
        if (!root || root.channelId !== channelId || root.threadRootId)
            throw new ApiError(422, "Invalid thread");
    }
    const mentioned = await memberIdsIn(
        channelId,
        messageInput.mentionUserIds.filter((userId) =>
            new Set(extractMentionIdsFromHtml(content)).has(userId)
        )
    );
    const [message] = await db.transaction(async (tx) => {
        const created = await tx
            .insert(messages)
            .values({
                channelId,
                authorUserId: actor.id,
                threadRootId: messageInput.threadRootId,
                body: content
            })
            .returning();
        const createdMessage = created[0];
        if (!createdMessage) throw new ApiError(500, "Could not create message");
        if (messageInput.attachments.length)
            await tx
                .insert(attachments)
                .values(
                    messageInput.attachments.map((attachment) => ({
                        ...attachment,
                        messageId: createdMessage.id,
                        uploaderId: actor.id
                    }))
                );
        if (mentioned.length)
            await tx
                .insert(mentions)
                .values(
                    mentioned.map((mentionedUserId) => ({
                        messageId: createdMessage.id,
                        mentionedUserId
                    }))
                );
        return created;
    });
    if (!message) throw new ApiError(500, "Could not create message");
    void ensureMessageLinkPreviews(message.id, htmlToText(content));
    void pushForNewMessage({ channelId, authorUserId: actor.id, mentionedUserIds: mentioned });
    return context.json({ message }, 201);
});

api.get("/channels/:channelId/messages/:messageId/thread", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await requireChannel(actor, channelId);
    const messageId = id(context.req.param("messageId"), "message id");
    const root = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
        columns: { channelId: true, threadRootId: true }
    });
    if (!root || root.channelId !== channelId || root.threadRootId) {
        throw new ApiError(404, "Thread not found");
    }
    return context.json({ messages: await listThreadMessages(messageId, actor.id) });
});

api.patch("/messages/:messageId", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const messageId = id(context.req.param("messageId"), "message id");
    const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
    if (!message || message.deletedAt || message.type === "system")
        throw new ApiError(404, "Message not found");
    const { channel, membership } = await authorizeApiChannel(
        actor,
        message.channelId,
        "channel:view"
    );
    if (
        message.authorUserId !== actor.id ||
        !canInChannel(actor, membership, channel, "message:edit_own")
    )
        throw new ApiError(403, "Not authorized");
    const input = await body(context.req.raw, editMessageSchema.omit({ messageId: true }));
    const content = sanitizeMessageHtml(input.body.trim());
    const mentioned = await memberIdsIn(
        message.channelId,
        input.mentionUserIds.filter((userId) =>
            new Set(extractMentionIdsFromHtml(content)).has(userId)
        )
    );
    await db.transaction(async (tx) => {
        await tx
            .update(messages)
            .set({ body: content, editedAt: new Date(), updatedAt: new Date() })
            .where(eq(messages.id, messageId));
        await tx.delete(mentions).where(eq(mentions.messageId, messageId));
        if (mentioned.length)
            await tx
                .insert(mentions)
                .values(mentioned.map((mentionedUserId) => ({ messageId, mentionedUserId })));
    });
    void ensureMessageLinkPreviews(messageId, htmlToText(content));
    return context.json({ updated: true });
});

api.delete("/messages/:messageId", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const messageId = id(context.req.param("messageId"), "message id");
    const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
    if (!message || message.deletedAt) return context.body(null, 204);
    if (message.type === "system") throw new ApiError(403, "System messages cannot be deleted");
    const { channel, membership } = await authorizeApiChannel(
        actor,
        message.channelId,
        "channel:view"
    );
    if (
        message.authorUserId !== actor.id &&
        !canInChannel(actor, membership, channel, "message:delete_any")
    )
        throw new ApiError(403, "Not authorized");
    await db
        .update(messages)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(messages.id, messageId));
    return context.body(null, 204);
});

api.put("/messages/:messageId/reactions/:emoji", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const messageId = id(context.req.param("messageId"), "message id");
    const emoji = decodeURIComponent(context.req.param("emoji"));
    if (!(REACTION_EMOJIS as readonly string[]).includes(emoji))
        throw new ApiError(422, "Invalid reaction");
    const message = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
        columns: { channelId: true, deletedAt: true, type: true }
    });
    if (!message || message.deletedAt || message.type === "system")
        throw new ApiError(404, "Message not found");
    await authorizeApiChannel(actor, message.channelId, "channel:post");
    await db
        .insert(messageReactions)
        .values({ messageId, userId: actor.id, emoji })
        .onConflictDoNothing();
    return context.json({ reacted: true }, 201);
});

api.delete("/messages/:messageId/reactions/:emoji", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const messageId = id(context.req.param("messageId"), "message id");
    const emoji = decodeURIComponent(context.req.param("emoji"));
    await db
        .delete(messageReactions)
        .where(
            and(
                eq(messageReactions.messageId, messageId),
                eq(messageReactions.userId, actor.id),
                eq(messageReactions.emoji, emoji)
            )
        );
    return context.body(null, 204);
});

api.get("/channels/:channelId/images", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const channelId = id(context.req.param("channelId"), "channel id");
    await requireChannel(actor, channelId);
    const offset = asOffset(context.req.query("offset"));
    const images = await listChannelImages(channelId, { offset, limit: GALLERY_PAGE_SIZE + 1 });
    return context.json({
        images: images.slice(0, GALLERY_PAGE_SIZE),
        hasMore: images.length > GALLERY_PAGE_SIZE,
        total: await countChannelImages(channelId)
    });
});

api.get("/users/:userId/profile", async (context) => {
    await requireApiUser(context.req.raw.headers);
    const profile = await getUserProfile(context.req.param("userId"));
    if (!profile) throw new ApiError(404, "User not found");
    return context.json({ profile });
});

api.get("/preferences", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    return context.json({ preferences: await getUserPreferences(actor.id) });
});

api.patch("/preferences/profile", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    await updatePreferences(actor, await body(context.req.raw, profilePrefsSchema), true);
    return context.json({ preferences: await getUserPreferences(actor.id) });
});

api.patch("/preferences/avatar", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    await updatePreferences(actor, await body(context.req.raw, avatarPrefsSchema), true);
    return context.json({ preferences: await getUserPreferences(actor.id) });
});

api.patch("/preferences/banner", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    await updatePreferences(actor, await body(context.req.raw, bannerPrefsSchema), true);
    return context.json({ preferences: await getUserPreferences(actor.id) });
});

api.patch("/preferences/appearance", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    await updatePreferences(actor, await body(context.req.raw, appearancePrefsSchema), false);
    return context.json({ preferences: await getUserPreferences(actor.id) });
});

api.patch("/preferences/notifications", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    await updatePreferences(actor, await body(context.req.raw, notificationPrefsSchema), false);
    return context.json({ preferences: await getUserPreferences(actor.id) });
});

api.post("/push-subscriptions", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const input = await body(context.req.raw, subscriptionSchema);
    await db
        .insert(pushSubscriptions)
        .values({ userId: actor.id, ...input })
        .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: { userId: actor.id, p256dh: input.p256dh, auth: input.auth }
        });
    return context.body(null, 204);
});

api.delete("/push-subscriptions", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const endpoint = context.req.query("endpoint");
    if (!endpoint) throw new ApiError(400, "Missing endpoint");
    await db
        .delete(pushSubscriptions)
        .where(
            and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, actor.id))
        );
    return context.body(null, 204);
});

api.post("/uploads/sign", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    if (!isCloudinaryConfigured()) throw new ApiError(503, "Uploads are not configured");
    return context.json(signUpload(Math.round(Date.now() / 1000), actor.id));
});

api.get("/admin/users", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    if (!isAppStaff(actor)) throw new ApiError(403, "Not authorized");
    const users = await db.query.user.findMany({
        orderBy: asc(user.createdAt),
        columns: {
            id: true,
            name: true,
            email: true,
            appRole: true,
            approvalStatus: true,
            createdAt: true
        },
        with: { preferences: { columns: { displayName: true, colorHue: true, avatarUrl: true } } }
    });
    return context.json({ users });
});

api.post("/admin/users", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    if (!canApp(actor, "user:approve")) throw new ApiError(403, "Not authorized");
    const input = await body(context.req.raw, inviteSchema);
    const existing = await db.query.user.findFirst({
        where: eq(user.email, input.email),
        columns: { id: true }
    });
    if (existing) throw new ApiError(409, "A user with that email already exists");
    const userId = crypto.randomUUID();
    await db
        .insert(user)
        .values({
            id: userId,
            name: input.name,
            email: input.email,
            emailVerified: true,
            appRole: "user",
            approvalStatus: "approved",
            approvedAt: new Date(),
            approvedByUserId: actor.id
        });
    try {
        await auth.api.signInMagicLink({
            body: { email: input.email, callbackURL: "/" },
            headers: context.req.raw.headers
        });
    } catch (error) {
        await db.delete(user).where(eq(user.id, userId));
        const emailPattern = `%"email":"${input.email.replace(/[\\%_]/g, "\\$&")}"%`;
        await db.delete(verification).where(sql`${verification.value} LIKE ${emailPattern}`);
        throw error;
    }
    void joinDefaultChannels(userId);
    getBroker().publishEphemeral({ type: "users.changed", ts: Date.now() });
    return context.json({ id: userId }, 201);
});

api.patch("/admin/users/:userId", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    const targetId = context.req.param("userId");
    const input = await body(
        context.req.raw,
        z
            .object({
                approvalStatus: z.enum(["approved", "pending", "rejected"]).optional(),
                appRole: z.enum(["admin", "user"]).optional()
            })
            .refine((value) => value.approvalStatus || value.appRole, "No changes supplied")
    );
    const target = await db.query.user.findFirst({
        where: eq(user.id, targetId),
        columns: { appRole: true }
    });
    if (!target) throw new ApiError(404, "User not found");
    if (target.appRole === "owner") throw new ApiError(403, "Cannot modify the application owner");
    if (
        input.approvalStatus &&
        !canApp(
            actor,
            input.approvalStatus === "rejected" || input.approvalStatus === "pending"
                ? "user:reject"
                : "user:approve"
        )
    )
        throw new ApiError(403, "Not authorized");
    if (
        input.appRole &&
        !canApp(actor, input.appRole === "admin" ? "user:promote_admin" : "user:demote")
    )
        throw new ApiError(403, "Not authorized");
    const values = {
        ...input,
        ...(input.approvalStatus === "approved"
            ? { approvedAt: new Date(), approvedByUserId: actor.id }
            : input.approvalStatus === "pending"
              ? { approvedAt: null, approvedByUserId: null }
              : {}),
        updatedAt: new Date()
    };
    await db.update(user).set(values).where(eq(user.id, targetId));
    if (input.approvalStatus === "approved") void joinDefaultChannels(targetId);
    getBroker().publishEphemeral({ type: "users.changed", ts: Date.now() });
    return context.json({ updated: true });
});

api.patch("/admin/settings", async (context) => {
    const actor = await requireApiUser(context.req.raw.headers);
    if (!isAppStaff(actor)) throw new ApiError(403, "Not authorized");
    const input = await body(context.req.raw, appSettingsSchema);
    const defaultChannelIds = [...new Set(input.defaultChannelIds)];
    if (defaultChannelIds.length) {
        const valid = await db.query.channels.findMany({
            where: and(
                inArray(channels.id, defaultChannelIds),
                eq(channels.isPrivate, false),
                eq(channels.isArchived, false)
            ),
            columns: { id: true }
        });
        if (valid.length !== defaultChannelIds.length)
            throw new ApiError(422, "Default channels must be existing public channels");
    }
    await db
        .insert(appSettings)
        .values({ id: "app", name: input.name, iconUrl: input.iconUrl, defaultChannelIds })
        .onConflictDoUpdate({
            target: appSettings.id,
            set: {
                name: input.name,
                iconUrl: input.iconUrl,
                defaultChannelIds,
                updatedAt: new Date()
            }
        });
    getBroker().publishEphemeral({ type: "settings.changed", ts: Date.now() });
    return context.json(await getAppSettings());
});

export type ApiV1 = typeof api;
export { api };
