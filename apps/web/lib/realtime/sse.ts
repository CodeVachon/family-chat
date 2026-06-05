import type { RealtimeEvent } from "./broker";

const encoder = new TextEncoder();

/**
 * Encode an event as a default-`message` SSE frame. The event `type` rides
 * inside the JSON payload so the client can handle everything in one
 * `onmessage` listener.
 */
export function encodeSSE(event: RealtimeEvent): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/** A comment line used as a heartbeat to keep the connection alive. */
export function encodeHeartbeat(): Uint8Array {
    return encoder.encode(`: ping\n\n`);
}

/** Tell the EventSource how long to wait before reconnecting. */
export function encodeRetry(ms: number): Uint8Array {
    return encoder.encode(`retry: ${ms}\n\n`);
}
