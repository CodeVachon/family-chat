import { beforeEach, describe, expect, it } from "bun:test";

import { brokerInstance } from "../../test/mocks/broker";
import { db } from "../../test/mocks/db";
import { request, resetAllMocks, signedInAs, uuid } from "../../test/helpers/api-v1";

beforeEach(resetAllMocks);

describe("GET /admin/users", () => {
    it("returns 403 for a non-staff actor", async () => {
        signedInAs({ appRole: "user" });

        const res = await request("GET", "/admin/users");

        expect(res.status).toBe(403);
    });

    it("returns the user list for staff", async () => {
        signedInAs({ appRole: "admin" });

        const res = await request("GET", "/admin/users");

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ users: [] });
    });
});

describe("POST /admin/users", () => {
    it("returns 403 for a non-staff actor", async () => {
        signedInAs({ appRole: "user" });

        const res = await request("POST", "/admin/users", {
            name: "New User",
            email: "new@example.com"
        });

        expect(res.status).toBe(403);
    });

    it("returns 409 when the email is already taken", async () => {
        signedInAs({ appRole: "admin" });
        db.query.user.findFirst.mockResolvedValueOnce({ id: "existing" });

        const res = await request("POST", "/admin/users", {
            name: "New User",
            email: "new@example.com"
        });

        expect(res.status).toBe(409);
    });

    it("invites a new user and returns 201", async () => {
        signedInAs({ appRole: "admin" });
        db.query.user.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("POST", "/admin/users", {
            name: "New User",
            email: "new@example.com"
        });

        expect(res.status).toBe(201);
        expect(brokerInstance.publishEphemeral).toHaveBeenCalledWith(
            expect.objectContaining({ type: "users.changed" })
        );
    });
});

describe("PATCH /admin/users/:userId", () => {
    it("rejects an empty body with 422", async () => {
        signedInAs({ appRole: "owner" });

        const res = await request("PATCH", "/admin/users/target", {});

        expect(res.status).toBe(422);
    });

    it("returns 404 for an unknown target", async () => {
        signedInAs({ appRole: "owner" });
        db.query.user.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("PATCH", "/admin/users/target", { approvalStatus: "approved" });

        expect(res.status).toBe(404);
    });

    it("approves a user for a staff actor", async () => {
        signedInAs({ appRole: "admin" });
        db.query.user.findFirst.mockResolvedValueOnce({ id: "target" });

        const res = await request("PATCH", "/admin/users/target", { approvalStatus: "approved" });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ updated: true });
    });

    it("returns 403 promoting to admin unless the actor is the app owner", async () => {
        signedInAs({ appRole: "admin" });
        db.query.user.findFirst.mockResolvedValueOnce({ id: "target" });

        const res = await request("PATCH", "/admin/users/target", { appRole: "admin" });

        expect(res.status).toBe(403);
    });

    it("promotes to admin for the app owner", async () => {
        signedInAs({ appRole: "owner" });
        db.query.user.findFirst
            .mockResolvedValueOnce({ id: "target" }) // handler's existence check
            .mockResolvedValueOnce({ appRole: "user" }); // assertNotOwner inside setUserAppRole

        const res = await request("PATCH", "/admin/users/target", { appRole: "admin" });

        expect(res.status).toBe(200);
    });
});

describe("PATCH /admin/settings", () => {
    it("returns 403 for a non-staff actor", async () => {
        signedInAs({ appRole: "user" });

        const res = await request("PATCH", "/admin/settings", { name: "Family Chat", iconUrl: null });

        expect(res.status).toBe(403);
    });

    it("saves settings with no default channels", async () => {
        signedInAs({ appRole: "owner" });

        const res = await request("PATCH", "/admin/settings", { name: "Family Chat", iconUrl: null });

        expect(res.status).toBe(200);
        expect(brokerInstance.publishEphemeral).toHaveBeenCalledWith(
            expect.objectContaining({ type: "settings.changed" })
        );
    });

    it("returns 400 when a default channel id is not a valid public channel", async () => {
        signedInAs({ appRole: "owner" });
        db.query.channels.findMany.mockResolvedValueOnce([]); // fewer than requested

        const res = await request("PATCH", "/admin/settings", {
            name: "Family Chat",
            iconUrl: null,
            defaultChannelIds: [uuid()]
        });

        expect(res.status).toBe(400);
    });
});
