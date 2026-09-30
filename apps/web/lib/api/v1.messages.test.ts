import { beforeEach, describe, expect, it } from "bun:test";

import { chain } from "../../test/mocks/chain";
import { isValidAttachmentUrl } from "../../test/mocks/cloudinary";
import { db } from "../../test/mocks/db";
import { pushForNewMessage } from "../../test/mocks/push-notify";
import { makeChannel, request, resetAllMocks, signedInAs, uuid } from "../../test/helpers/api-v1";

import { MESSAGE_RATE_LIMIT, rateLimit } from "@/lib/security/rate-limit";

beforeEach(resetAllMocks);

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
    function grantPost() {
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel({ isArchived: false }));
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
    }

    it("posts a message and returns 201", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        grantPost();
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

    it("replays the original result for a repeated clientMessageId in the same channel", async () => {
        signedInAs();
        const channelId = uuid();
        grantPost();
        const existing = {
            id: uuid(),
            channelId,
            authorUserId: uuid(),
            body: "<p>hi</p>",
            clientMessageId: "11111111-1111-4111-8111-111111111111"
        };
        db.query.messages.findFirst.mockResolvedValueOnce(existing);

        const res = await request("POST", `/channels/${channelId}/messages`, {
            body: "<p>hi</p>",
            clientMessageId: existing.clientMessageId
        });

        expect(res.status).toBe(201);
        const resBody = await res.json();
        expect(resBody.message).toEqual(existing);
        expect(db.insert).not.toHaveBeenCalled();
        expect(pushForNewMessage).not.toHaveBeenCalled();
    });

    it("returns 409 when clientMessageId was already used in a different channel", async () => {
        signedInAs();
        const channelId = uuid();
        grantPost();
        db.query.messages.findFirst.mockResolvedValueOnce({
            id: uuid(),
            channelId: uuid(), // a different channel
            clientMessageId: "22222222-2222-4222-8222-222222222222"
        });

        const res = await request("POST", `/channels/${channelId}/messages`, {
            body: "<p>hi</p>",
            clientMessageId: "22222222-2222-4222-8222-222222222222"
        });

        expect(res.status).toBe(409);
    });

    it("falls back to the concurrently-inserted row when the race is lost", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        grantPost();
        const winner = {
            id: uuid(),
            channelId,
            authorUserId: actor.id,
            body: "<p>hi</p>",
            clientMessageId: "33333333-3333-4333-8333-333333333333"
        };
        // Not found by the pre-check (no replay detected yet)...
        db.query.messages.findFirst.mockResolvedValueOnce(undefined);
        // ...but the insert's onConflictDoNothing returns no row (another
        // concurrent request with the same key won), so the handler re-queries.
        db.insert.mockReturnValueOnce(chain([]));
        db.query.messages.findFirst.mockResolvedValueOnce(winner);

        const res = await request("POST", `/channels/${channelId}/messages`, {
            body: "<p>hi</p>",
            clientMessageId: winner.clientMessageId
        });

        expect(res.status).toBe(201);
        const resBody = await res.json();
        expect(resBody.message).toEqual(winner);
        expect(pushForNewMessage).not.toHaveBeenCalled();
    });

    // Regression coverage for the bug this suite was added to catch: the v1
    // schema (postMessageObjectSchema.omit({channelId}).refine(...)) must be
    // constructible and must still enforce the same emptiness rule as the
    // schema used by the server-action call site.
    it("rejects a whitespace-only body via the schema refinement (422, no attachments)", async () => {
        signedInAs();
        const channelId = uuid();
        grantPost();

        const res = await request("POST", `/channels/${channelId}/messages`, { body: "   " });

        expect(res.status).toBe(422);
        const resBody = await res.json();
        expect(resBody.error.message).toBe("Validation failed");
        expect(resBody.error.issues[0].message).toBe("Message cannot be empty");
    });

    it("rejects a body that sanitizes to empty content (422, past the schema)", async () => {
        signedInAs();
        const channelId = uuid();
        grantPost();

        // Non-empty per the raw-string schema check, but htmlToText reduces an
        // empty tag to "" — a second, independent emptiness guard in the handler.
        const res = await request("POST", `/channels/${channelId}/messages`, { body: "<p></p>" });

        expect(res.status).toBe(422);
        const resBody = await res.json();
        expect(resBody.error.message).toBe("Message cannot be empty");
    });

    it("returns 403 for a role outside the posting roles", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "viewer" });

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
        signedInAs();
        const channelId = uuid();
        grantPost();
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
        signedInAs();
        const channelId = uuid();
        grantPost();
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
        grantPost();
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
        signedInAs();
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
