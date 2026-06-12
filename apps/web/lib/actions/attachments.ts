"use server";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { attachmentComments, attachmentLikes, attachments, messages } from "@workspace/db/schema";

import { authorizeChannel } from "@/lib/dal";
import { canInChannel, type ChannelAction } from "@/lib/permissions";
import { getBroker } from "@/lib/realtime/broker";

const MAX_COMMENT_LENGTH = 2000;

/**
 * Resolve an attachment to its channel and authorize the actor for `action`,
 * via the attachment → message → channel chain. Returns the loaded context
 * (incl. channelId for revalidation/fan-out). Throws/interrupts on failure.
 */
async function authorizeAttachment(attachmentId: string, action: ChannelAction) {
    const attachment = await db.query.attachments.findFirst({
        where: eq(attachments.id, attachmentId),
        columns: { id: true, messageId: true }
    });
    if (!attachment) throw new Error("Attachment not found");
    const message = await db.query.messages.findFirst({
        where: eq(messages.id, attachment.messageId),
        columns: { channelId: true, deletedAt: true }
    });
    if (!message || message.deletedAt) throw new Error("Attachment not found");
    const ctx = await authorizeChannel(message.channelId, action);
    return { ...ctx, channelId: message.channelId };
}

/** Notify the channel so other clients refresh like/comment state. */
function notifyChannel(channelId: string) {
    getBroker().publishEphemeral({ type: "reaction.changed", channelId, ts: Date.now() });
}

export async function toggleAttachmentLike(attachmentId: string) {
    const { user, channelId } = await authorizeAttachment(attachmentId, "channel:post");
    const existing = await db.query.attachmentLikes.findFirst({
        where: and(
            eq(attachmentLikes.attachmentId, attachmentId),
            eq(attachmentLikes.userId, user.id)
        )
    });
    if (existing) {
        await db.delete(attachmentLikes).where(eq(attachmentLikes.id, existing.id));
    } else {
        await db
            .insert(attachmentLikes)
            .values({ attachmentId, userId: user.id })
            .onConflictDoNothing();
    }
    notifyChannel(channelId);
}

export type AttachmentCommentView = {
    id: string;
    body: string;
    createdAt: Date;
    editedAt: Date | null;
    authorUserId: string;
    authorName: string;
    authorColorHue: number;
    authorAvatarUrl: string | null;
    canDelete: boolean;
};

/** Comments for an attachment (oldest first), with the viewer's delete rights. */
export async function listAttachmentComments(
    attachmentId: string
): Promise<AttachmentCommentView[]> {
    const { user, channel, membership } = await authorizeAttachment(attachmentId, "channel:view");
    const canDeleteAny = canInChannel(user, membership, channel, "message:delete_any");

    const rows = await db.query.attachmentComments.findMany({
        where: and(
            eq(attachmentComments.attachmentId, attachmentId),
            isNull(attachmentComments.deletedAt)
        ),
        orderBy: asc(attachmentComments.createdAt),
        with: {
            author: {
                columns: { id: true, name: true },
                with: {
                    preferences: { columns: { displayName: true, colorHue: true, avatarUrl: true } }
                }
            }
        }
    });

    return rows.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        editedAt: c.editedAt,
        authorUserId: c.authorUserId,
        authorName: c.author.preferences?.displayName ?? c.author.name,
        authorColorHue: c.author.preferences?.colorHue ?? 220,
        authorAvatarUrl: c.author.preferences?.avatarUrl ?? null,
        canDelete: c.authorUserId === user.id || canDeleteAny
    }));
}

export async function addAttachmentComment(attachmentId: string, rawBody: string) {
    const body = rawBody.trim();
    if (body.length === 0) throw new Error("Comment cannot be empty");
    if (body.length > MAX_COMMENT_LENGTH) throw new Error("Comment is too long");

    const { user, channelId } = await authorizeAttachment(attachmentId, "channel:post");
    await db.insert(attachmentComments).values({ attachmentId, authorUserId: user.id, body });
    notifyChannel(channelId);
}

export async function deleteAttachmentComment(commentId: string) {
    const comment = await db.query.attachmentComments.findFirst({
        where: eq(attachmentComments.id, commentId)
    });
    if (!comment || comment.deletedAt) return;

    const { user, channel, membership, channelId } = await authorizeAttachment(
        comment.attachmentId,
        "channel:view"
    );
    const isAuthor = comment.authorUserId === user.id;
    if (!isAuthor && !canInChannel(user, membership, channel, "message:delete_any")) {
        throw new Error("Not authorized");
    }

    await db
        .update(attachmentComments)
        .set({ deletedAt: new Date() })
        .where(eq(attachmentComments.id, commentId));
    notifyChannel(channelId);
}
