import { beforeEach, describe, expect, it } from "bun:test";

import { brokerInstance } from "../../test/mocks/broker";
import { db } from "../../test/mocks/db";
import { request, resetAllMocks, signedInAs } from "../../test/helpers/api-v1";

beforeEach(resetAllMocks);

describe("GET /users/:userId/profile", () => {
    it("returns 404 for an unknown user", async () => {
        signedInAs();
        db.query.user.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("GET", "/users/ghost/profile");

        expect(res.status).toBe(404);
    });

    it("returns the profile for a known user", async () => {
        signedInAs();
        db.query.user.findFirst.mockResolvedValueOnce({
            id: "target",
            name: "Target User",
            email: "target@example.com",
            preferences: null
        });

        const res = await request("GET", "/users/target/profile");

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.profile.userId).toBe("target");
    });
});

describe("GET /preferences", () => {
    it("returns default preferences for a new user", async () => {
        signedInAs();

        const res = await request("GET", "/preferences");

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.preferences).toMatchObject({ themePreference: "system" });
    });
});

describe("PATCH /preferences/*", () => {
    it("profile: saves and syncs users", async () => {
        signedInAs();

        const res = await request("PATCH", "/preferences/profile", {
            displayName: null,
            colorHue: 220,
            avatarUrl: null
        });

        expect(res.status).toBe(200);
        expect(brokerInstance.publishEphemeral).toHaveBeenCalledWith(
            expect.objectContaining({ type: "users.changed" })
        );
    });

    it("profile: rejects an out-of-range colorHue with 422", async () => {
        signedInAs();

        const res = await request("PATCH", "/preferences/profile", {
            displayName: null,
            colorHue: 999,
            avatarUrl: null
        });

        expect(res.status).toBe(422);
    });

    it("avatar: saves and syncs users", async () => {
        signedInAs();

        const res = await request("PATCH", "/preferences/avatar", {
            avatarUrl: null,
            avatarSourceUrl: null,
            avatarCrop: null
        });

        expect(res.status).toBe(200);
        expect(brokerInstance.publishEphemeral).toHaveBeenCalledTimes(1);
    });

    it("banner: saves and syncs users", async () => {
        signedInAs();

        const res = await request("PATCH", "/preferences/banner", {
            bannerUrl: null,
            bannerSourceUrl: null,
            bannerCrop: null
        });

        expect(res.status).toBe(200);
        expect(brokerInstance.publishEphemeral).toHaveBeenCalledTimes(1);
    });

    it("appearance: saves without syncing users", async () => {
        signedInAs();

        const res = await request("PATCH", "/preferences/appearance", {
            themePreference: "dark",
            dateTimeFormat: "12h",
            fontSizeScale: "default",
            fontFamily: "figtree"
        });

        expect(res.status).toBe(200);
        expect(brokerInstance.publishEphemeral).not.toHaveBeenCalled();
    });

    it("appearance: rejects an invalid enum with 422", async () => {
        signedInAs();

        const res = await request("PATCH", "/preferences/appearance", {
            themePreference: "rainbow",
            dateTimeFormat: "12h",
            fontSizeScale: "default",
            fontFamily: "figtree"
        });

        expect(res.status).toBe(422);
    });

    it("notifications: saves without syncing users", async () => {
        signedInAs();

        const res = await request("PATCH", "/preferences/notifications", {
            notificationLevel: "all"
        });

        expect(res.status).toBe(200);
        expect(brokerInstance.publishEphemeral).not.toHaveBeenCalled();
    });
});
