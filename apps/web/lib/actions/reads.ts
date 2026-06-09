"use server";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channelMembers, messages } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";

/**
 * Mark a channel as read up to its latest message for the current user.
 * No-ops for non-members (no membership row to update). The read-pointer
 * trigger emits a `read.updated` event so the user's other tabs resync.
 */
export async function markChannelRead(channelId: string) {
    const user = await requireApprovedUser();

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
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));
}
