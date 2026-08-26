import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channelMembers, channels, messages, user } from "@workspace/db/schema";

import { insertSystemMessage } from "@/lib/messaging/system-messages";
import type { ChannelRole } from "@/lib/permissions";

export class ServiceError extends Error {
    constructor(
        message: string,
        public readonly status = 400
    ) {
        super(message);
    }
}

export async function getChannelMembership(channelId: string, userId: string) {
    return db.query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId))
    });
}

async function assertTargetNotOwner(channelId: string, userId: string) {
    const target = await db.query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)),
        columns: { role: true }
    });
    if (target?.role === "owner") throw new ServiceError("Cannot modify the channel owner", 409);
}

export async function joinPublicChannel(channelId: string, userId: string) {
    const channel = await db.query.channels.findFirst({ where: eq(channels.id, channelId) });
    if (!channel) throw new ServiceError("Channel not found", 404);
    if (channel.isPrivate) throw new ServiceError("Cannot join a private channel", 403);

    await db.transaction(async (tx) => {
        const inserted = await tx
            .insert(channelMembers)
            .values({ channelId, userId, role: "user" })
            .onConflictDoNothing()
            .returning({ id: channelMembers.id });
        if (inserted.length > 0) {
            await insertSystemMessage(tx, {
                channelId,
                event: "join",
                subjectUserId: userId,
                actorUserId: userId
            });
        }
    });
}

export async function leaveChannelMembership(channelId: string, userId: string) {
    const membership = await getChannelMembership(channelId, userId);
    if (membership?.role === "owner") {
        throw new ServiceError(
            "The channel owner cannot leave; transfer ownership or delete it",
            409
        );
    }

    await removeMembership(channelId, userId, userId);
}

async function removeMembership(channelId: string, userId: string, actorUserId: string) {
    await db.transaction(async (tx) => {
        const removed = await tx
            .delete(channelMembers)
            .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
            .returning({ id: channelMembers.id });
        if (removed.length > 0) {
            await insertSystemMessage(tx, {
                channelId,
                event: "leave",
                subjectUserId: userId,
                actorUserId
            });
        }
    });
}

export async function addMemberToChannel(
    channelId: string,
    targetUserId: string,
    role: Exclude<ChannelRole, "owner">,
    actorUserId: string
) {
    const target = await db.query.user.findFirst({
        where: eq(user.id, targetUserId),
        columns: { approvalStatus: true }
    });
    if (!target || target.approvalStatus !== "approved") {
        throw new ServiceError("User must be an approved member", 422);
    }

    await db.transaction(async (tx) => {
        const inserted = await tx
            .insert(channelMembers)
            .values({ channelId, userId: targetUserId, role })
            .onConflictDoNothing()
            .returning({ id: channelMembers.id });
        if (inserted.length > 0) {
            await insertSystemMessage(tx, {
                channelId,
                event: "join",
                subjectUserId: targetUserId,
                actorUserId
            });
        }
    });
}

export async function updateChannelMemberRole(
    channelId: string,
    userId: string,
    role: Exclude<ChannelRole, "owner">
) {
    await assertTargetNotOwner(channelId, userId);
    await db
        .update(channelMembers)
        .set({ role, updatedAt: new Date() })
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
}

export async function removeMemberFromChannel(
    channelId: string,
    userId: string,
    actorUserId: string
) {
    await assertTargetNotOwner(channelId, userId);
    await removeMembership(channelId, userId, actorUserId);
}

export async function recordChannelRead(channelId: string, userId: string) {
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
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
}
