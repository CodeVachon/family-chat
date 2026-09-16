import { mock } from "bun:test";

/** Fake `@/lib/push/notify` — the real one sends actual web-push network calls. */
export const pushForNewMessage = mock(async () => undefined as unknown);

export function resetPushNotify() {
    pushForNewMessage.mockReset().mockImplementation(async () => undefined);
}
