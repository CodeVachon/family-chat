import { mock } from "bun:test";

/** Fake `auth` standing in for `@/lib/auth`'s heavyweight betterAuth() instance. */
export const auth = {
    api: {
        signInMagicLink: mock(async () => undefined as unknown),
        // Session shape consumed by requireApiUser (lib/api/auth.ts); null means
        // "no session" (401). Tests set this per-request via mockResolvedValueOnce.
        getSession: mock(async () => null as unknown)
    }
};

export function resetAuth() {
    auth.api.signInMagicLink.mockReset().mockImplementation(async () => undefined);
    auth.api.getSession.mockReset().mockImplementation(async () => null);
}
