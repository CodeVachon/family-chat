import "server-only";

import { getBroker, type RealtimeEvent } from "./broker";
import { encodeHeartbeat, encodeRetry, encodeSSE } from "./sse";
import { listVisibleChannelIds } from "@/lib/queries/channels";

const HEARTBEAT_MS = 25_000;

// iOS can suspend a backgrounded/locked PWA without ever closing its
// EventSource's underlying connection — no `abort` fires, and a heartbeat
// write into the void doesn't fail until the OS eventually notices the peer
// is gone, which can take days. Until then the zombie subscriber keeps
// occupying one of the user's `MAX_CONNECTIONS_PER_USER` slots, and once
// those fill up every real reconnect gets rejected with no way to recover
// short of restarting the server. Proactively recycling every connection
// bounds how long a zombie can hold a slot; a live client just reconnects
// immediately (`retry: 3000`, or the foreground-reconnect in
// realtime-provider.tsx).
const MAX_CONNECTION_AGE_MS = 4 * 60 * 60 * 1000;

/**
 * Opens the authenticated event stream used by both the Next web client and
 * the versioned REST API. The caller authenticates first, allowing the same
 * stream to work with either a browser session cookie or a bearer token.
 */
export async function createRealtimeStream(request: Request, userId: string): Promise<Response> {
    const broker = getBroker();
    await broker.start();

    if (!broker.hasCapacityFor(userId)) {
        return new Response("Too many concurrent connections", { status: 429 });
    }

    const channelIds = await listVisibleChannelIds(userId);
    let unsubscribe: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let maxAge: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (maxAge) clearTimeout(maxAge);
        maxAge = null;
        unsubscribe?.();
        unsubscribe = null;
    };

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const push = (event: RealtimeEvent) => {
                try {
                    controller.enqueue(encodeSSE(event));
                } catch {
                    cleanup();
                }
            };

            const close = () => {
                cleanup();
                try {
                    controller.close();
                } catch {
                    /* Stream has already closed. */
                }
            };

            controller.enqueue(encodeRetry(3000));
            unsubscribe = broker.subscribe({ userId, channelIds, push });
            if (!unsubscribe) {
                try {
                    controller.close();
                } catch {
                    /* Stream has already closed. */
                }
                return;
            }
            push({ type: "ready", ts: Date.now() });
            heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encodeHeartbeat());
                } catch {
                    cleanup();
                }
            }, HEARTBEAT_MS);
            maxAge = setTimeout(close, MAX_CONNECTION_AGE_MS);
            request.signal.addEventListener("abort", close);
        },
        cancel() {
            cleanup();
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no"
        }
    });
}
