import { mock } from "bun:test";

/** Fake `@/lib/messaging/system-messages` exports. */
export const insertSystemMessage = mock(async () => undefined as unknown);

export function resetSystemMessages() {
    insertSystemMessage.mockReset().mockImplementation(async () => undefined);
}
