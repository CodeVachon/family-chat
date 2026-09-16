import { mock } from "bun:test";

/**
 * Fake `@/lib/realtime/stream` — the real implementation opens a long-lived
 * SSE ReadableStream backed by the broker's Postgres LISTEN connection, which
 * has no place in a route-wiring test. GET /stream only needs to see that its
 * result is returned verbatim.
 */
export const createRealtimeStream = mock(
    async () => new Response("stream", { status: 200, headers: { "Content-Type": "text/event-stream" } })
);

export function resetRealtimeStream() {
    createRealtimeStream
        .mockReset()
        .mockImplementation(
            async () =>
                new Response("stream", { status: 200, headers: { "Content-Type": "text/event-stream" } })
        );
}
