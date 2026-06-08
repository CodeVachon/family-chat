import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channelMembers, channels } from "@workspace/db/schema";

import { pushToUsers } from "./send";

/**
 * Send background push for a newly posted message:
 *  - mentioned members get a "mention" push (unless their level is 'none')
 *  - members with level 'all' get a "new message" push
 * The author is always excluded; mentioned users aren't double-notified.
 * Fire-and-forget — call without awaiting from the post action.
 */
export async function pushForNewMessage(opts: {
    channelId: string;
    authorUserId: string;
    mentionedUserIds: string[];
}): Promise<void> {
    const channel = await db.query.channels.findFirst({
        where: eq(channels.id, opts.channelId),
        columns: { name: true }
    });
    if (!channel) return;

    const members = await db.query.channelMembers.findMany({
        where: eq(channelMembers.channelId, opts.channelId),
        with: { user: { with: { preferences: { columns: { notificationLevel: true } } } } }
    });

    const url = `/channels/${opts.channelId}`;
    const mentioned = new Set(opts.mentionedUserIds);

    const mentionTargets: string[] = [];
    const messageTargets: string[] = [];

    for (const m of members) {
        if (m.userId === opts.authorUserId) continue;
        const level = m.user.preferences?.notificationLevel ?? "mentions";
        if (level === "none") continue;

        if (mentioned.has(m.userId)) {
            mentionTargets.push(m.userId);
        } else if (level === "all") {
            messageTargets.push(m.userId);
        }
    }

    await Promise.all([
        pushToUsers(mentionTargets, {
            title: "New mention",
            body: `You were mentioned in #${channel.name}`,
            url,
            tag: `mention-${opts.channelId}`
        }),
        pushToUsers(messageTargets, {
            title: `New message in #${channel.name}`,
            body: "You have a new message",
            url,
            tag: `message-${opts.channelId}`
        })
    ]);
}
