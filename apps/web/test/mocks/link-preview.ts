import { mock } from "bun:test";

/** Fake `@/lib/messaging/link-preview` — the real one fetches arbitrary URLs. */
export const ensureMessageLinkPreviews = mock(async () => undefined as unknown);

export function resetLinkPreview() {
    ensureMessageLinkPreviews.mockReset().mockImplementation(async () => undefined);
}
