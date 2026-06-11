"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";

import type { ComposerMember } from "@/components/channels/composer";
import { MessageList } from "@/components/channels/message-list";
import type { MessageViewer } from "@/components/channels/message-toolbar";
import { loadOlderChannelMessages } from "@/lib/actions/channel-messages";
import type { ChannelMessage } from "@/lib/queries/channels";
import { Button } from "@workspace/ui/components/button";

/** Dedupe by id and sort chronologically (createdAt, then id as a stable tiebreaker). */
function sortDedup(messages: ChannelMessage[]): ChannelMessage[] {
    const byId = new Map<string, ChannelMessage>();
    for (const m of messages) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => {
        const t = a.createdAt.getTime() - b.createdAt.getTime();
        if (t !== 0) return t;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/**
 * Wraps the message list with on-demand "load older" paging. The server renders
 * the latest page; clicking the button keyset-pages backwards and prepends the
 * results, preserving scroll position so the viewport doesn't jump.
 *
 * Realtime updates re-render the server component with a shifted newest-N
 * window (via router.refresh). Once the user has paged back, we retain the
 * messages that scrolled out of that window and render a deduped, sorted union,
 * so the visible history never develops a gap or a duplicate.
 */
export function MessageHistory({
    channelId,
    initialMessages,
    initialHasMore,
    viewer,
    members
}: {
    channelId: string;
    initialMessages: ChannelMessage[];
    initialHasMore: boolean;
    viewer: MessageViewer;
    members: ComposerMember[];
}) {
    const [older, setOlder] = useState<ChannelMessage[]>([]);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [pending, startTransition] = useTransition();

    const anchorRef = useRef<HTMLDivElement>(null);
    // Scroll height captured just before a fetch, so we can re-anchor after.
    const restore = useRef<{ el: HTMLElement; prevHeight: number } | null>(null);
    const prevInitial = useRef(initialMessages);

    // When the server re-renders a shifted newest-N window, fold the previous
    // window into `older` so messages that scrolled out aren't lost from the
    // paged-back view. Only matters once the user has actually paged back.
    useEffect(() => {
        if (prevInitial.current === initialMessages) return;
        const carried = prevInitial.current;
        prevInitial.current = initialMessages;
        setOlder((prev) => (prev.length ? sortDedup([...prev, ...carried]) : prev));
    }, [initialMessages]);

    const messages = useMemo(
        () => (older.length ? sortDedup([...older, ...initialMessages]) : initialMessages),
        [older, initialMessages]
    );

    function loadOlder() {
        const oldest = messages[0];
        if (!oldest || pending) return;

        const el = anchorRef.current?.closest<HTMLElement>('[data-component="MessageScroller"]');
        if (el) restore.current = { el, prevHeight: el.scrollHeight };

        startTransition(async () => {
            const page = await loadOlderChannelMessages(channelId, {
                id: oldest.id,
                createdAt: oldest.createdAt.toISOString()
            });
            setHasMore(page.hasMore);
            if (page.messages.length) setOlder((prev) => sortDedup([...page.messages, ...prev]));
        });
    }

    // Keep the viewport anchored to the same message after the list grows upward.
    useLayoutEffect(() => {
        const r = restore.current;
        if (!r) return;
        restore.current = null;
        r.el.scrollTop += r.el.scrollHeight - r.prevHeight;
    }, [messages]);

    return (
        <div data-component="MessageHistory">
            {hasMore && (
                <div ref={anchorRef} className="flex justify-center py-2">
                    <Button variant="ghost" size="sm" onClick={loadOlder} disabled={pending}>
                        {pending ? "Loading…" : "Load older messages"}
                    </Button>
                </div>
            )}
            <MessageList messages={messages} viewer={viewer} members={members} />
        </div>
    );
}
