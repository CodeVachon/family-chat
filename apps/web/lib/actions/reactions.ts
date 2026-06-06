"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { messageReactions, messages } from "@workspace/db/schema";

import { authorizeChannel } from "@/lib/dal";
import { REACTION_EMOJIS } from "@/lib/validation/channel";

const ALLOWED = new Set(REACTION_EMOJIS);

export async function toggleReaction(messageId: string, emoji: string) {
    if (!ALLOWED.has(emoji)) throw new Error("Invalid reaction");

    const message = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
        columns: { channelId: true, deletedAt: true }
    });
    if (!message || message.deletedAt) return;

    const { user } = await authorizeChannel(message.channelId, "channel:post");

    const existing = await db.query.messageReactions.findFirst({
        where: and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.userId, user.id),
            eq(messageReactions.emoji, emoji)
        )
    });

    if (existing) {
        await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
    } else {
        await db
            .insert(messageReactions)
            .values({ messageId, userId: user.id, emoji })
            .onConflictDoNothing();
    }

    revalidatePath(`/channels/${message.channelId}`);
}
