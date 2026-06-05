"use client";

import { useEffect } from "react";

import { markChannelRead } from "@/lib/actions/reads";

/**
 * Marks the channel read when viewed, and again whenever the latest message
 * changes (so unread stays cleared while you're looking at the channel).
 * Renders nothing.
 */
export function MarkReadOnView({
    channelId,
    latestMessageId
}: {
    channelId: string;
    latestMessageId: string | null;
}) {
    useEffect(() => {
        void markChannelRead(channelId);
    }, [channelId, latestMessageId]);

    return null;
}
