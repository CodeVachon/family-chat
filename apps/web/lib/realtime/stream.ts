import "server-only";

import { getBroker, type RealtimeEvent } from "./broker";
import { encodeHeartbeat, encodeRetry, encodeSSE } from "./sse";
import { listVisibleChannelIds } from "@/lib/queries/channels";

const HEARTBEAT_MS = 25_000;

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

    const cleanup = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
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
            request.signal.addEventListener("abort", () => {
                cleanup();
                try {
                    controller.close();
                } catch {
                    /* Stream has already closed. */
                }
            });
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
