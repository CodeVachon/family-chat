"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { attachments, channelMembers, mentions, messages } from "@workspace/db/schema";

import { isValidAttachmentUrl } from "@/lib/cloudinary/server";
import { authorizeChannel } from "@/lib/dal";
import { ensureMessageLinkPreviews } from "@/lib/messaging/link-preview";
import {
    extractMentionIdsFromHtml,
    htmlToText,
    sanitizeMessageHtml
} from "@/lib/messaging/rich-text";
import { canInChannel } from "@/lib/permissions";
import { pushForNewMessage } from "@/lib/push/notify";
import { editMessageSchema, postMessageSchema } from "@/lib/validation/channel";

/** Filter the given user ids to those that are members of the channel. */
async function memberIdsIn(channelId: string, userIds: string[]): Promise<string[]> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return [];
    const rows = await db
        .select({ userId: channelMembers.userId })
        .from(channelMembers)
        .where(
            and(eq(channelMembers.channelId, channelId), inArray(channelMembers.userId, unique))
        );
    return rows.map((r) => r.userId);
}

export async function postMessage(input: unknown) {
    const data = postMessageSchema.parse(input);
    const { user } = await authorizeChannel(data.channelId, "channel:post");

    // Sanitize the rich-text HTML before it ever touches the DB.
    const body = sanitizeMessageHtml(data.body.trim());
    if (htmlToText(body).length === 0 && data.attachments.length === 0) {
        throw new Error("Message cannot be empty");
    }

    // Attachment URLs are client-supplied; confirm each is a genuine Cloudinary
    // delivery URL for our cloud before persisting (prevents stored XSS /
    // content injection via secureUrl).
    for (const attachment of data.attachments) {
        if (!isValidAttachmentUrl(attachment.secureUrl, attachment.publicId)) {
            throw new Error("Invalid attachment");
        }
    }

    if (data.threadRootId) {
        const root = await db.query.messages.findFirst({
            where: eq(messages.id, data.threadRootId),
            columns: { channelId: true, threadRootId: true }
        });
        if (!root || root.channelId !== data.channelId) throw new Error("Invalid thread");
        if (root.threadRootId) throw new Error("Cannot reply to a reply");
    }

    // Only honor mention ids that are actually @-mentioned in the body, so a
    // client can't push-spam members it didn't visibly mention.
    const inBody = new Set(extractMentionIdsFromHtml(body));
    const mentionIds = await memberIdsIn(
        data.channelId,
        data.mentionUserIds.filter((id) => inBody.has(id))
    );

    const created = await db.transaction(async (tx) => {
        const [message] = await tx
            .insert(messages)
            .values({
                channelId: data.channelId,
                authorUserId: user.id,
                threadRootId: data.threadRootId ?? null,
                body
            })
            .returning({ id: messages.id, createdAt: messages.createdAt });

        if (data.attachments.length > 0) {
            await tx.insert(attachments).values(
                data.attachments.map((a) => ({
                    messageId: message!.id,
                    uploaderId: user.id,
                    kind: a.kind,
                    publicId: a.publicId,
                    resourceType: a.resourceType,
                    secureUrl: a.secureUrl,
                    format: a.format,
                    bytes: a.bytes,
                    width: a.width,
                    height: a.height,
                    originalFilename: a.originalFilename
                }))
            );
        }

        if (mentionIds.length > 0) {
            await tx
                .insert(mentions)
                .values(
                    mentionIds.map((uid) => ({ messageId: message!.id, mentionedUserId: uid }))
                );
        }

        return message!;
    });

    void ensureMessageLinkPreviews(created.id, htmlToText(body));
    // Background push (mentions always; new messages for 'all'-level members).
    void pushForNewMessage({
        channelId: data.channelId,
        authorUserId: user.id,
        mentionedUserIds: mentionIds
    });
    revalidatePath(`/channels/${data.channelId}`);

    // Returned so the client can reconcile its optimistic message with the
    // persisted row (exact id match, no duplicate on the next refetch).
    return { id: created.id, createdAt: created.createdAt };
}

export async function editMessage(input: unknown) {
    const data = editMessageSchema.parse(input);

    const message = await db.query.messages.findFirst({ where: eq(messages.id, data.messageId) });
    if (!message || message.deletedAt) throw new Error("Message not found");
    if (message.type === "system") throw new Error("System messages cannot be edited");

    const { user, channel, membership } = await authorizeChannel(message.channelId, "channel:view");
    const isAuthor = message.authorUserId === user.id;
    const canEdit =
        (isAuthor && canInChannel(user, membership, channel, "message:edit_own")) ||
        canInChannel(user, membership, channel, "message:edit_any");
    if (!canEdit) throw new Error("Not authorized");

    const body = sanitizeMessageHtml(data.body.trim());
    if (htmlToText(body).length === 0) throw new Error("Message cannot be empty");

    const inBody = new Set(extractMentionIdsFromHtml(body));
    const mentionIds = await memberIdsIn(
        message.channelId,
        data.mentionUserIds.filter((id) => inBody.has(id))
    );

    await db.transaction(async (tx) => {
        await tx
            .update(messages)
            .set({ body, editedAt: new Date(), updatedAt: new Date() })
            .where(eq(messages.id, data.messageId));
        await tx.delete(mentions).where(eq(mentions.messageId, data.messageId));
        if (mentionIds.length > 0) {
            await tx
                .insert(mentions)
                .values(
                    mentionIds.map((uid) => ({ messageId: data.messageId, mentionedUserId: uid }))
                );
        }
    });

    void ensureMessageLinkPreviews(data.messageId, htmlToText(body));
    revalidatePath(`/channels/${message.channelId}`);
}

export async function deleteMessage(messageId: string) {
    const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
    if (!message || message.deletedAt) return;
    if (message.type === "system") throw new Error("System messages cannot be deleted");

    const { user, channel, membership } = await authorizeChannel(message.channelId, "channel:view");
    const isAuthor = message.authorUserId === user.id;
    const canDelete = isAuthor || canInChannel(user, membership, channel, "message:delete_any");
    if (!canDelete) throw new Error("Not authorized");

    await db
        .update(messages)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(messages.id, messageId));

    revalidatePath(`/channels/${message.channelId}`);
}
