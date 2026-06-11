import { getSession } from "@/lib/dal";
import { getBroker, type RealtimeEvent } from "@/lib/realtime/broker";
import { encodeHeartbeat, encodeRetry, encodeSSE } from "@/lib/realtime/sse";
import { listVisibleChannelIds } from "@/lib/queries/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
    const session = await getSession();
    if (!session || session.user.approvalStatus !== "approved") {
        return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;
    const broker = getBroker();
    await broker.start();

    // Reject before opening the stream when the user is at their connection cap.
    if (!broker.hasCapacityFor(userId)) {
        return new Response("Too many concurrent connections", { status: 429 });
    }

    // Channels this user can receive events for (public + member channels). The
    // broker re-resolves this server-side on channels.changed, so fan-out stays
    // authoritative even if the client never reconnects.
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
                // Raced past the pre-check and hit the cap; close immediately.
                try {
                    controller.close();
                } catch {
                    /* already closed */
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
                    /* already closed */
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
