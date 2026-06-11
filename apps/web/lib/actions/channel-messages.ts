"use server";

import { authorizeChannel } from "@/lib/dal";
import {
    CHANNEL_PAGE_SIZE,
    listChannelMessages,
    type ChannelMessage
} from "@/lib/queries/channels";

export type OlderMessagesPage = {
    messages: ChannelMessage[];
    hasMore: boolean;
};

/**
 * Fetch the page of top-level messages immediately older than `before` (the
 * oldest message currently shown). Authorizes channel access per call so it's
 * safe to invoke directly from the client.
 */
export async function loadOlderChannelMessages(
    channelId: string,
    before: { id: string; createdAt: string }
): Promise<OlderMessagesPage> {
    const { user } = await authorizeChannel(channelId, "channel:view");

    const messages = await listChannelMessages(channelId, user.id, {
        before: { id: before.id, createdAt: new Date(before.createdAt) }
    });

    // A full page implies there may be older messages still.
    return { messages, hasMore: messages.length >= CHANNEL_PAGE_SIZE };
}
