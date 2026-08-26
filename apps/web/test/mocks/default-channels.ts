import { mock } from "bun:test";

/** Fake `@/lib/channels/default-channels` exports. */
export const joinDefaultChannels = mock(async () => undefined as unknown);
export const bootstrapFirstRun = mock(async () => undefined as unknown);

export function resetDefaultChannels() {
    joinDefaultChannels.mockReset().mockImplementation(async () => undefined);
    bootstrapFirstRun.mockReset().mockImplementation(async () => undefined);
}
