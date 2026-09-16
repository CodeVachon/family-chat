import { beforeEach, describe, expect, it } from "bun:test";

import { chain } from "../../test/mocks/chain";
import { db } from "../../test/mocks/db";
import { request, resetAllMocks, signedInAs } from "../../test/helpers/api-v1";

beforeEach(resetAllMocks);

describe("public routes (no auth)", () => {
    it("GET /health always succeeds", async () => {
        const res = await request("GET", "/health");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
    });

    it("GET /settings returns defaults when unconfigured", async () => {
        const res = await request("GET", "/settings");
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ name: "Family Chat", defaultChannelIds: [] });
    });

    it("GET /vapid-public-key returns null when unset", async () => {
        const res = await request("GET", "/vapid-public-key");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ publicKey: null });
    });
});

describe("GET /me", () => {
    it("returns the actor, preferences, and unread count", async () => {
        const actor = signedInAs();

        const res = await request("GET", "/me");

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.user.id).toBe(actor.id);
        expect(body.preferences).toMatchObject({ themePreference: "system" });
        expect(body.unread).toBe(0);
    });
});

describe("GET /unread", () => {
    it("returns the unread total", async () => {
        signedInAs();
        db.select.mockReturnValueOnce(chain([{ total: 3 }]));

        const res = await request("GET", "/unread");

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ total: 3 });
    });
});

describe("GET /stream", () => {
    it("returns the mocked realtime stream", async () => {
        signedInAs();

        const res = await request("GET", "/stream");

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");
    });
});
