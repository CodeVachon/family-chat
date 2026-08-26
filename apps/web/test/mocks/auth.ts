import { mock } from "bun:test";

/** Fake `auth` standing in for `@/lib/auth`'s heavyweight betterAuth() instance. */
export const auth = {
    api: {
        signInMagicLink: mock(async () => undefined as unknown)
    }
};

export function resetAuth() {
    auth.api.signInMagicLink.mockReset().mockImplementation(async () => undefined);
}
