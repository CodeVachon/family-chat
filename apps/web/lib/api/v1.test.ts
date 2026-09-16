import { beforeEach, describe, expect, it } from "bun:test";

import { auth, resetAuth } from "../../test/mocks/auth";
import { brokerInstance, resetBroker } from "../../test/mocks/broker";
import { chain } from "../../test/mocks/chain";
import { isValidAttachmentUrl, resetCloudinary } from "../../test/mocks/cloudinary";
import { db, resetDb } from "../../test/mocks/db";
import { resetDefaultChannels } from "../../test/mocks/default-channels";
import { resetLinkPreview } from "../../test/mocks/link-preview";
import { pushForNewMessage, resetPushNotify } from "../../test/mocks/push-notify";
import { resetRealtimeStream } from "../../test/mocks/realtime-stream";
import { insertSystemMessage, resetSystemMessages } from "../../test/mocks/system-messages";

import { MESSAGE_RATE_LIMIT, rateLimit } from "@/lib/security/rate-limit";

import { api } from "./v1";

/**
 * Route-wiring tests for the versioned REST API (everything except Better
 * Auth's own routes, which live outside this file). These exercise
 * authentication, permission gating, request validation, status codes, and
 * response shaping by driving the real Hono app end-to-end through
 * `api.request()`. Business logic inside the underlying services/queries
 * (channel-members, admin, app-settings, messages) already has its own
 * dedicated unit tests — those are exercised here for real (against the same
 * fake `db`) rather than re-verified, so these tests focus on what only this
 * layer can get wrong: auth/permission checks, schema wiring, and error →
 * HTTP status mapping.
 */

let idCounter = 0;
/** A syntactically valid v4-looking UUID, unique per call. */
function uuid(): string {
    idCounter++;
    const n = idCounter.toString(16).padStart(12, "0");
    return `${n.slice(0, 8)}-${n.slice(8, 12)}-4${n.slice(0, 3)}-8${n.slice(0, 3)}-${n}`;
}

type Actor = {
    id: string;
    name: string;
    email: string;
    appRole: "owner" | "admin" | "user";
    approvalStatus: "approved" | "pending" | "rejected";
};

/** Authenticate the next request as this user (one-shot, like the real session check). */
function signedInAs(overrides: Partial<Actor> = {}): Actor {
    const actor: Actor = {
        id: uuid(),
        name: "Test User",
        email: `${uuid()}@example.com`,
        appRole: "user",
        approvalStatus: "approved",
        ...overrides
    };
    auth.api.getSession.mockResolvedValueOnce({ user: actor });
    return actor;
}

function makeChannel(overrides: Record<string, unknown> = {}) {
    return {
        id: uuid(),
        name: "General",
        description: null,
        color: "#3b82f6",
        icon: "hash",
        isPrivate: false,
        isArchived: false,
        archivedAt: null,
        createdByUserId: uuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

function request(method: string, path: string, json?: unknown) {
    const init: RequestInit = { method };
    if (json !== undefined) {
        init.headers = { "content-type": "application/json" };
        init.body = JSON.stringify(json);
    }
    return api.request(`/api/v1${path}`, init);
}

beforeEach(() => {
    resetAuth();
    resetDb();
    resetBroker();
    resetCloudinary();
    resetDefaultChannels();
    resetLinkPreview();
    resetPushNotify();
    resetRealtimeStream();
    resetSystemMessages();
});

describe("authentication guard", () => {
    // Every route below calls requireApiUser (directly or via channelRequest /
    // messageRequest) as its first step, before touching the body or the db —
    // so a missing/invalid session must 401 regardless of the route's own logic.
    const PROTECTED_ROUTES: Array<[string, string]> = [
        ["GET", "/me"],
        ["GET", "/unread"],
        ["GET", "/stream"],
        ["GET", "/channels"],
        ["GET", "/activity"],
        ["POST", "/channels"],
        ["GET", "/channels/public"],
        ["GET", `/channels/${uuid()}`],
        ["PATCH", `/channels/${uuid()}`],
        ["PATCH", `/channels/${uuid()}/archive`],
        ["DELETE", `/channels/${uuid()}`],
        ["POST", `/channels/${uuid()}/join`],
        ["POST", `/channels/${uuid()}/leave`],
        ["PATCH", `/channels/${uuid()}/favorite`],
        ["POST", `/channels/${uuid()}/read`],
        ["POST", `/channels/${uuid()}/typing`],
        ["GET", `/channels/${uuid()}/members`],
        ["GET", `/channels/${uuid()}/addable-users`],
        ["POST", `/channels/${uuid()}/members`],
        ["PATCH", `/channels/${uuid()}/members/u1`],
        ["DELETE", `/channels/${uuid()}/members/u1`],
        ["GET", `/channels/${uuid()}/messages`],
        ["POST", `/channels/${uuid()}/messages`],
        ["GET", `/channels/${uuid()}/messages/${uuid()}/thread`],
        ["PATCH", `/messages/${uuid()}`],
        ["DELETE", `/messages/${uuid()}`],
        ["PUT", `/messages/${uuid()}/reactions/${encodeURIComponent("👍")}`],
        ["DELETE", `/messages/${uuid()}/reactions/${encodeURIComponent("👍")}`],
        ["GET", `/channels/${uuid()}/images`],
        ["GET", "/users/u1/profile"],
        ["GET", "/preferences"],
        ["PATCH", "/preferences/profile"],
        ["PATCH", "/preferences/avatar"],
        ["PATCH", "/preferences/banner"],
        ["PATCH", "/preferences/appearance"],
        ["PATCH", "/preferences/notifications"],
        ["POST", "/push-subscriptions"],
        ["DELETE", "/push-subscriptions"],
        ["POST", "/uploads/sign"],
        ["GET", "/admin/users"],
        ["POST", "/admin/users"],
        ["PATCH", "/admin/users/u1"],
        ["PATCH", "/admin/settings"]
    ];

    for (const [method, path] of PROTECTED_ROUTES) {
        it(`${method} ${path} returns 401 without a session`, async () => {
            const res = await request(method, path);
            expect(res.status).toBe(401);
        });
    }

    it("returns 403 when the session belongs to an unapproved user", async () => {
        signedInAs({ approvalStatus: "pending" });

        const res = await request("GET", "/me");

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.message).toBe("An approved account is required");
    });
});

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

describe("GET /channels/:channelId/members", () => {
    it("returns the flattened member list", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        const res = await request("GET", `/channels/${uuid()}/members`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ members: [] });
    });
});

describe("GET /channels/:channelId/addable-users", () => {
    it("requires channel:manage_members", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        const res = await request("GET", `/channels/${uuid()}/addable-users`);

        expect(res.status).toBe(403);
    });

    it("returns approved users not already members", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "admin" });

        const res = await request("GET", `/channels/${uuid()}/addable-users`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ users: [] });
    });
});

describe("POST /channels/:channelId/members", () => {
    it("rejects an unapproved target with 422", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "admin" });
        db.query.user.findFirst.mockResolvedValueOnce({ approvalStatus: "pending" });

        const res = await request("POST", `/channels/${uuid()}/members`, { userId: "target" });

        expect(res.status).toBe(422);
    });

    it("adds an approved target and returns 201", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "admin" });
        db.query.user.findFirst.mockResolvedValueOnce({ approvalStatus: "approved" });
        db.insert.mockReturnValueOnce(chain([{ id: uuid() }]));

        const res = await request("POST", `/channels/${uuid()}/members`, { userId: "target" });

        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ added: true });
    });
});

describe("PATCH /channels/:channelId/members/:userId", () => {
    it("returns 409 when the target is the channel owner", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst
            .mockResolvedValueOnce({ role: "admin" }) // actor's own membership (permission check)
            .mockResolvedValueOnce({ role: "owner" }); // target lookup inside the service

        const res = await request("PATCH", `/channels/${uuid()}/members/target`, { role: "admin" });

        expect(res.status).toBe(409);
    });

    it("updates the target's role", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst
            .mockResolvedValueOnce({ role: "admin" })
            .mockResolvedValueOnce({ role: "user" });

        const res = await request("PATCH", `/channels/${uuid()}/members/target`, { role: "admin" });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ role: "admin" });
    });
});

describe("DELETE /channels/:channelId/members/:userId", () => {
    it("returns 409 when the target is the channel owner", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst
            .mockResolvedValueOnce({ role: "admin" })
            .mockResolvedValueOnce({ role: "owner" });

        const res = await request("DELETE", `/channels/${uuid()}/members/target`);

        expect(res.status).toBe(409);
    });

    it("removes a non-owner target", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst
            .mockResolvedValueOnce({ role: "admin" })
            .mockResolvedValueOnce({ role: "user" });
        db.delete.mockReturnValueOnce(chain([{ id: uuid() }]));

        const res = await request("DELETE", `/channels/${uuid()}/members/target`);

        expect(res.status).toBe(204);
    });
});

describe("GET /channels/:channelId/messages", () => {
    it("returns an empty page", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("GET", `/channels/${uuid()}/messages`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ messages: [], hasMore: false });
    });

    it("returns 400 for a malformed cursor id", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);
        const channelId = uuid();

        const res = await request(
            "GET",
            `/channels/${channelId}/messages?beforeId=not-a-uuid&beforeCreatedAt=2024-01-01T00:00:00.000Z`
        );

        expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid cursor timestamp", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);
        const channelId = uuid();

        const res = await request(
            "GET",
            `/channels/${channelId}/messages?beforeId=${uuid()}&beforeCreatedAt=not-a-date`
        );

        expect(res.status).toBe(400);
    });
});

describe("POST /channels/:channelId/messages", () => {
    function grantPost(actorId: string) {
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel({ isArchived: false }));
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
        void actorId;
    }

    it("posts a message and returns 201", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        grantPost(actor.id);
        const created = {
            id: uuid(),
            channelId,
            authorUserId: actor.id,
            threadRootId: null,
            body: "<p>hi</p>"
        };
        db.insert.mockReturnValueOnce(chain([created]));

        const res = await request("POST", `/channels/${channelId}/messages`, { body: "<p>hi</p>" });

        expect(res.status).toBe(201);
        const resBody = await res.json();
        expect(resBody.message.id).toBe(created.id);
        expect(pushForNewMessage).toHaveBeenCalledTimes(1);
    });

    // Regression coverage for the bug this suite was added to catch: the v1
    // schema (postMessageObjectSchema.omit({channelId}).refine(...)) must be
    // constructible and must still enforce the same emptiness rule as the
    // schema used by the server-action call site.
    it("rejects a whitespace-only body via the schema refinement (422, no attachments)", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        grantPost(actor.id);

        const res = await request("POST", `/channels/${channelId}/messages`, { body: "   " });

        expect(res.status).toBe(422);
        const resBody = await res.json();
        expect(resBody.error.message).toBe("Validation failed");
        expect(resBody.error.issues[0].message).toBe("Message cannot be empty");
    });

    it("rejects a body that sanitizes to empty content (422, past the schema)", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        grantPost(actor.id);

        // Non-empty per the raw-string schema check, but htmlToText reduces an
        // empty tag to "" — a second, independent emptiness guard in the handler.
        const res = await request("POST", `/channels/${channelId}/messages`, { body: "<p></p>" });

        expect(res.status).toBe(422);
        const resBody = await res.json();
        expect(resBody.error.message).toBe("Message cannot be empty");
    });

    it("returns 403 for a role outside the posting roles", async () => {
        const actor = signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "viewer" });
        void actor;

        const res = await request("POST", `/channels/${uuid()}/messages`, { body: "<p>hi</p>" });

        expect(res.status).toBe(403);
    });

    it("returns 403 when the channel is archived", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel({ isArchived: true }));
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        const res = await request("POST", `/channels/${uuid()}/messages`, { body: "<p>hi</p>" });

        expect(res.status).toBe(403);
    });

    it("returns 422 for an invalid attachment url", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        grantPost(actor.id);
        isValidAttachmentUrl.mockReturnValueOnce(false);

        const res = await request("POST", `/channels/${channelId}/messages`, {
            body: "<p>photo</p>",
            attachments: [
                {
                    kind: "image",
                    publicId: "p1",
                    resourceType: "image",
                    secureUrl: "https://res.cloudinary.com/x/image/upload/v1/p1.png",
                    format: "png",
                    bytes: 100,
                    width: 10,
                    height: 10,
                    originalFilename: "p.png"
                }
            ]
        });

        expect(res.status).toBe(422);
        const resBody = await res.json();
        expect(resBody.error.message).toBe("Invalid attachment");
    });

    it("returns 422 for a thread root in a different channel", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        grantPost(actor.id);
        db.query.messages.findFirst.mockResolvedValueOnce({
            channelId: uuid(),
            threadRootId: null
        });

        const res = await request("POST", `/channels/${channelId}/messages`, {
            body: "<p>reply</p>",
            threadRootId: uuid()
        });

        expect(res.status).toBe(422);
        const resBody = await res.json();
        expect(resBody.error.message).toBe("Invalid thread");
    });

    it("returns 429 once the posting budget is exhausted", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        grantPost(actor.id);
        // Seed the same in-memory limiter the route reads, rather than driving
        // MESSAGE_RATE_LIMIT.limit real requests through the full db-mocked path.
        for (let i = 0; i < MESSAGE_RATE_LIMIT.limit; i++) {
            rateLimit(`message:${actor.id}`, MESSAGE_RATE_LIMIT);
        }

        const res = await request("POST", `/channels/${channelId}/messages`, { body: "<p>hi</p>" });

        expect(res.status).toBe(429);
    });
});

describe("GET /channels/:channelId/messages/:messageId/thread", () => {
    it("returns 404 when the root message is not found", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);
        db.query.messages.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("GET", `/channels/${uuid()}/messages/${uuid()}/thread`);

        expect(res.status).toBe(404);
    });

    it("returns the thread for a valid root", async () => {
        signedInAs();
        const channelId = uuid();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);
        db.query.messages.findFirst.mockResolvedValueOnce({ channelId, threadRootId: null });

        const res = await request("GET", `/channels/${channelId}/messages/${uuid()}/thread`);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ messages: [] });
    });
});

describe("PATCH /messages/:messageId", () => {
    it("returns 404 for a deleted message", async () => {
        signedInAs();
        db.query.messages.findFirst.mockResolvedValueOnce({ deletedAt: new Date() });

        const res = await request("PATCH", `/messages/${uuid()}`, { body: "edited" });

        expect(res.status).toBe(404);
    });

    it("returns 403 when the actor is not the author", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        db.query.messages.findFirst.mockResolvedValueOnce({
            id: uuid(),
            channelId,
            authorUserId: "someone-else",
            deletedAt: null,
            type: "text"
        });
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
        void actor;

        const res = await request("PATCH", `/messages/${uuid()}`, { body: "edited" });

        expect(res.status).toBe(403);
    });

    it("edits the actor's own message", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        db.query.messages.findFirst.mockResolvedValueOnce({
            id: uuid(),
            channelId,
            authorUserId: actor.id,
            deletedAt: null,
            type: "text"
        });
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        const res = await request("PATCH", `/messages/${uuid()}`, { body: "<p>edited</p>" });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ updated: true });
    });
});

describe("DELETE /messages/:messageId", () => {
    it("no-ops (204) for an already-deleted message", async () => {
        signedInAs();
        db.query.messages.findFirst.mockResolvedValueOnce({ deletedAt: new Date() });

        const res = await request("DELETE", `/messages/${uuid()}`);

        expect(res.status).toBe(204);
    });

    it("returns 403 for a system message", async () => {
        signedInAs();
        db.query.messages.findFirst.mockResolvedValueOnce({ deletedAt: null, type: "system" });

        const res = await request("DELETE", `/messages/${uuid()}`);

        expect(res.status).toBe(403);
    });

    it("returns 403 when a non-author lacks message:delete_any", async () => {
        signedInAs();
        const channelId = uuid();
        db.query.messages.findFirst.mockResolvedValueOnce({
            channelId,
            authorUserId: "someone-else",
            deletedAt: null,
            type: "text"
        });
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        const res = await request("DELETE", `/messages/${uuid()}`);

        expect(res.status).toBe(403);
    });

    it("soft-deletes the actor's own message", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        db.query.messages.findFirst.mockResolvedValueOnce({
            channelId,
            authorUserId: actor.id,
            deletedAt: null,
            type: "text"
        });
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        const res = await request("DELETE", `/messages/${uuid()}`);

        expect(res.status).toBe(204);
    });
});

describe("PUT /messages/:messageId/reactions/:emoji", () => {
    it("returns 422 for an emoji outside the curated set", async () => {
        signedInAs();

        const res = await request(
            "PUT",
            `/messages/${uuid()}/reactions/${encodeURIComponent("🦄")}`
        );

        expect(res.status).toBe(422);
    });

    it("returns 404 for a missing message", async () => {
        signedInAs();
        db.query.messages.findFirst.mockResolvedValueOnce(undefined);

        const res = await request(
            "PUT",
            `/messages/${uuid()}/reactions/${encodeURIComponent("👍")}`
        );

        expect(res.status).toBe(404);
    });

    it("adds a reaction and returns 201", async () => {
        signedInAs();
        const channelId = uuid();
        db.query.messages.findFirst.mockResolvedValueOnce({
            channelId,
            deletedAt: null,
            type: "text"
        });
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        const res = await request(
            "PUT",
            `/messages/${uuid()}/reactions/${encodeURIComponent("👍")}`
        );

        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ reacted: true });
    });
});

describe("DELETE /messages/:messageId/reactions/:emoji", () => {
    it("removes a reaction", async () => {
        signedInAs();

        const res = await request(
            "DELETE",
            `/messages/${uuid()}/reactions/${encodeURIComponent("👍")}`
        );

        expect(res.status).toBe(204);
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

describe("POST /push-subscriptions", () => {
    it("saves a subscription", async () => {
        signedInAs();

        const res = await request("POST", "/push-subscriptions", {
            endpoint: "https://push.example.com/abc",
            p256dh: "key",
            auth: "secret"
        });

        expect(res.status).toBe(204);
    });

    it("rejects a non-url endpoint with 422", async () => {
        signedInAs();

        const res = await request("POST", "/push-subscriptions", {
            endpoint: "not-a-url",
            p256dh: "key",
            auth: "secret"
        });

        expect(res.status).toBe(422);
    });
});

describe("DELETE /push-subscriptions", () => {
    it("returns 400 without an endpoint", async () => {
        signedInAs();

        const res = await request("DELETE", "/push-subscriptions");

        expect(res.status).toBe(400);
    });

    it("removes the subscription", async () => {
        signedInAs();

        const res = await request(
            "DELETE",
            "/push-subscriptions?endpoint=https%3A%2F%2Fpush.example.com%2Fabc"
        );

        expect(res.status).toBe(204);
    });
});

describe("POST /uploads/sign", () => {
    it("returns a signature when Cloudinary is configured", async () => {
        signedInAs();

        const res = await request("POST", "/uploads/sign");

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.signature).toBe("sig");
    });

    it("returns 503 when Cloudinary is not configured", async () => {
        signedInAs();
        const { isCloudinaryConfigured } = await import("../../test/mocks/cloudinary");
        isCloudinaryConfigured.mockReturnValueOnce(false);

        const res = await request("POST", "/uploads/sign");

        expect(res.status).toBe(503);
    });
});

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
