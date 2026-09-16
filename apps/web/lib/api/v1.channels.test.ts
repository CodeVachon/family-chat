import { beforeEach, describe, expect, it } from "bun:test";

import { brokerInstance } from "../../test/mocks/broker";
import { chain } from "../../test/mocks/chain";
import { db } from "../../test/mocks/db";
import { insertSystemMessage } from "../../test/mocks/system-messages";
import { auth, makeChannel, request, resetAllMocks, signedInAs, uuid } from "../../test/helpers/api-v1";

beforeEach(resetAllMocks);

describe("GET /channels", () => {
    it("returns the visible channel list", async () => {
        signedInAs();

        const res = await request("GET", "/channels");

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ channels: [] });
    });
});

describe("GET /activity", () => {
    it("returns the activity feed", async () => {
        signedInAs();

        const res = await request("GET", "/activity");

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ channels: [] });
    });
});

describe("POST /channels", () => {
    it("creates a channel and returns 201", async () => {
        const actor = signedInAs();
        const created = makeChannel({ name: "General", createdByUserId: actor.id });
        db.insert.mockReturnValueOnce(chain([created]));

        const res = await request("POST", "/channels", { name: "General" });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.channel.id).toBe(created.id);
        expect(insertSystemMessage).toHaveBeenCalledTimes(1);
    });

    it("rejects an invalid body with 422", async () => {
        signedInAs();

        const res = await request("POST", "/channels", { name: "" });

        expect(res.status).toBe(422);
    });
});

describe("GET /channels/public", () => {
    it("returns public channels", async () => {
        signedInAs();

        const res = await request("GET", "/channels/public");

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ channels: [] });
    });
});

describe("GET /channels/:channelId", () => {
    it("returns 400 for a malformed channel id", async () => {
        signedInAs();

        const res = await request("GET", "/channels/not-a-uuid");

        expect(res.status).toBe(400);
    });

    it("returns 404 when the channel does not exist", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("GET", `/channels/${uuid()}`);

        expect(res.status).toBe(404);
    });

    it("returns 403 for a private channel the actor cannot view", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel({ isPrivate: true }));
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("GET", `/channels/${uuid()}`);

        expect(res.status).toBe(403);
    });

    it("returns the channel with capabilities for a public channel", async () => {
        signedInAs();
        const channel = makeChannel({ isPrivate: false });
        db.query.channels.findFirst.mockResolvedValueOnce(channel);
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("GET", `/channels/${channel.id}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.channel.id).toBe(channel.id);
        expect(body.membership).toBeNull();
        expect(body.capabilities).toEqual({
            // Viewable by anyone (public), but posting/managing still require membership.
            canPost: false,
            canManage: false,
            canManageMembers: false
        });
    });
});

describe("PATCH /channels/:channelId", () => {
    it("returns 403 for a non-management role", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        const res = await request("PATCH", `/channels/${uuid()}`, { name: "New name" });

        expect(res.status).toBe(403);
    });

    it("updates the channel for an owner and announces the rename", async () => {
        signedInAs();
        const channel = makeChannel({ name: "Old name" });
        db.query.channels.findFirst.mockResolvedValueOnce(channel);
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "owner" });
        db.update.mockReturnValueOnce(chain([{ ...channel, name: "New name" }]));

        const res = await request("PATCH", `/channels/${channel.id}`, { name: "New name" });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.channel.name).toBe("New name");
        expect(insertSystemMessage).toHaveBeenCalledWith(
            db,
            expect.objectContaining({ event: "channel_updated", renamedTo: "New name" })
        );
    });

    it("rejects an invalid body with 422", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "owner" });

        const res = await request("PATCH", `/channels/${uuid()}`, { name: "" });

        expect(res.status).toBe(422);
    });
});

describe("PATCH /channels/:channelId/archive", () => {
    it("archives the channel for an admin", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "admin" });
        db.update.mockReturnValueOnce(chain([makeChannel({ isArchived: true })]));

        const res = await request("PATCH", `/channels/${uuid()}/archive`, { archived: true });

        expect(res.status).toBe(200);
    });

    it("rejects a non-boolean body with 422", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "admin" });

        const res = await request("PATCH", `/channels/${uuid()}/archive`, { archived: "yes" });

        expect(res.status).toBe(422);
    });
});

describe("DELETE /channels/:channelId", () => {
    it("returns 403 for a non-owner, non-app-owner actor", async () => {
        signedInAs({ appRole: "admin" });
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "admin" });

        const res = await request("DELETE", `/channels/${uuid()}`);

        expect(res.status).toBe(403);
    });

    it("allows the channel owner", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "owner" });

        const res = await request("DELETE", `/channels/${uuid()}`);

        expect(res.status).toBe(204);
    });

    it("allows the application owner even without a membership row", async () => {
        signedInAs({ appRole: "owner" });
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("DELETE", `/channels/${uuid()}`);

        expect(res.status).toBe(204);
    });
});

describe("POST /channels/:channelId/join", () => {
    it("returns 404 when the channel does not exist", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("POST", `/channels/${uuid()}/join`);

        expect(res.status).toBe(404);
    });

    it("joins a public channel", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel({ isPrivate: false }));
        db.insert.mockReturnValueOnce(chain([{ id: uuid() }]));

        const res = await request("POST", `/channels/${uuid()}/join`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ joined: true });
    });
});

describe("POST /channels/:channelId/leave", () => {
    it("returns 409 when the actor is the channel owner", async () => {
        signedInAs();
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "owner" });

        const res = await request("POST", `/channels/${uuid()}/leave`);

        expect(res.status).toBe(409);
    });

    it("removes the membership for a non-owner", async () => {
        signedInAs();
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
        db.delete.mockReturnValueOnce(chain([{ id: uuid() }]));

        const res = await request("POST", `/channels/${uuid()}/leave`);

        expect(res.status).toBe(204);
    });
});

describe("PATCH /channels/:channelId/favorite", () => {
    it("toggles favorite and returns it back", async () => {
        signedInAs();

        const res = await request("PATCH", `/channels/${uuid()}/favorite`, { favorite: true });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ favorite: true });
    });

    it("rejects a non-boolean body with 422", async () => {
        signedInAs();

        const res = await request("PATCH", `/channels/${uuid()}/favorite`, { favorite: "yes" });

        expect(res.status).toBe(422);
    });
});

describe("POST /channels/:channelId/read", () => {
    it("marks the channel read", async () => {
        signedInAs();

        const res = await request("POST", `/channels/${uuid()}/read`);

        expect(res.status).toBe(204);
    });
});

describe("POST /channels/:channelId/typing", () => {
    it("publishes a typing event for a member, then throttles a rapid second call", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        db.query.channelMembers.findFirst.mockResolvedValue({ role: "user" });
        // A fresh actor/channel pair each test avoids cross-test rate-limit
        // collisions, so both calls below are guaranteed to hit the same window.

        const first = await request("POST", `/channels/${channelId}/typing`);
        // Session mock is one-shot per requireApiUser call — re-authenticate as
        // the same actor for the second request in this window.
        auth.api.getSession.mockResolvedValueOnce({ user: actor });
        const second = await request("POST", `/channels/${channelId}/typing`);

        expect(first.status).toBe(204);
        expect(second.status).toBe(204);
        expect(brokerInstance.publishEphemeral).toHaveBeenCalledTimes(1);
    });

    it("does not publish when the actor is not a channel member", async () => {
        signedInAs();
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("POST", `/channels/${uuid()}/typing`);

        expect(res.status).toBe(204);
        expect(brokerInstance.publishEphemeral).not.toHaveBeenCalled();
    });
});

describe("GET /channels/:channelId/images", () => {
    it("returns an empty gallery page", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("GET", `/channels/${uuid()}/images`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ images: [], hasMore: false, total: 0 });
    });
});
