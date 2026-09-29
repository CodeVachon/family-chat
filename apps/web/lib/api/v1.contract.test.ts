import { beforeEach, describe, expect, it } from "bun:test";

import { chain } from "../../test/mocks/chain";
import { db } from "../../test/mocks/db";
import { makeChannel, request, resetAllMocks, signedInAs, uuid } from "../../test/helpers/api-v1";

import {
    channelDetailResponseSchema,
    channelMemberSchema,
    channelMessagesPageSchema,
    errorEnvelopeSchema,
    meResponseSchema,
    realtimeEventSchema,
    sendMessageResponseSchema,
    threadResponseSchema,
    visibleChannelSchema
} from "./contract/schemas";
import {
    channelDetailResponseFixture,
    channelMemberFixture,
    channelMessagesPageFixture,
    decoratedMessageFixture,
    errorEnvelopeFixture,
    meResponseFixture,
    realtimeEventFixtures,
    sendMessageResponseFixture,
    threadResponseFixture,
    validationErrorEnvelopeFixture,
    visibleChannelFixture
} from "./contract/fixtures";

/**
 * Machine-checked half of docs/rest-api.md: every fixture must satisfy its
 * schema (so a fixture never documents a shape the schema itself doesn't
 * allow), and a representative live request per resource in the "Fixtures"
 * table must satisfy the same schema (so a route handler can't silently drift
 * from what's documented). This complements, rather than replaces, the
 * broader route-wiring coverage in the sibling v1.*.test.ts files — those
 * cover status codes and permission/validation branches; this file covers
 * response *shape*.
 */

beforeEach(resetAllMocks);

describe("fixtures satisfy their schemas", () => {
    it("meResponseFixture", () => {
        meResponseSchema.parse(meResponseFixture);
    });

    it("visibleChannelFixture", () => {
        visibleChannelSchema.parse(visibleChannelFixture);
    });

    it("channelDetailResponseFixture", () => {
        channelDetailResponseSchema.parse(channelDetailResponseFixture);
    });

    it("channelMemberFixture", () => {
        channelMemberSchema.parse(channelMemberFixture);
    });

    it("channelMessagesPageFixture", () => {
        channelMessagesPageSchema.parse(channelMessagesPageFixture);
    });

    it("threadResponseFixture", () => {
        threadResponseSchema.parse(threadResponseFixture);
    });

    it("sendMessageResponseFixture", () => {
        sendMessageResponseSchema.parse(sendMessageResponseFixture);
    });

    it("decoratedMessageFixture also satisfies the top-level history item shape", () => {
        // Top-level history adds replyCount/lastReplyAt on top of the thread shape.
        channelMessagesPageSchema.parse({
            messages: [{ ...decoratedMessageFixture, replyCount: 0, lastReplyAt: null }],
            hasMore: false
        });
    });

    it("errorEnvelopeFixture", () => {
        errorEnvelopeSchema.parse(errorEnvelopeFixture);
    });

    it("validationErrorEnvelopeFixture", () => {
        errorEnvelopeSchema.parse(validationErrorEnvelopeFixture);
    });

    it("every realtime event fixture", () => {
        for (const event of Object.values(realtimeEventFixtures)) {
            realtimeEventSchema.parse(event);
        }
    });
});

describe("live responses satisfy their schemas", () => {
    it("GET /me", async () => {
        signedInAs();

        const res = await request("GET", "/me");
        const body = await res.json();

        expect(res.status).toBe(200);
        meResponseSchema.parse(body);
    });

    it("GET /channels/:channelId", async () => {
        signedInAs();
        const channel = makeChannel();
        const membership = {
            id: uuid(),
            channelId: channel.id,
            userId: uuid(),
            role: "user",
            isFavorite: false,
            lastReadMessageId: null,
            lastReadAt: null,
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        db.query.channels.findFirst.mockResolvedValueOnce(channel);
        db.query.channelMembers.findFirst.mockResolvedValueOnce(membership);

        const res = await request("GET", `/channels/${channel.id}`);
        const body = await res.json();

        expect(res.status).toBe(200);
        channelDetailResponseSchema.parse(body);
    });

    it("GET /channels/:channelId/members", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
        db.query.channelMembers.findMany.mockResolvedValueOnce([
            {
                userId: uuid(),
                role: "user",
                user: {
                    name: "Jamie",
                    preferences: { displayName: "Jamie", colorHue: 220, avatarUrl: null }
                }
            }
        ]);

        const res = await request("GET", `/channels/${uuid()}/members`);
        const body = await res.json();

        expect(res.status).toBe(200);
        for (const member of body.members) {
            channelMemberSchema.parse(member);
        }
    });

    it("GET /channels/:channelId/messages", async () => {
        signedInAs();
        const authorId = uuid();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);
        db.query.messages.findMany.mockResolvedValueOnce([
            {
                id: uuid(),
                channelId: uuid(),
                authorUserId: authorId,
                type: "user",
                systemEvent: null,
                threadRootId: null,
                body: "<p>Dinner's at 6</p>",
                editedAt: null,
                deletedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                author: { id: authorId, name: "Jamie", preferences: null },
                attachments: [],
                reactions: [],
                mentions: []
            }
        ]);

        const res = await request("GET", `/channels/${uuid()}/messages`);
        const body = await res.json();

        expect(res.status).toBe(200);
        channelMessagesPageSchema.parse(body);
    });

    it("POST /channels/:channelId/messages", async () => {
        const actor = signedInAs();
        const channelId = uuid();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
        db.insert.mockReturnValueOnce(
            chain([
                {
                    id: uuid(),
                    channelId,
                    authorUserId: actor.id,
                    type: "user",
                    systemEvent: null,
                    threadRootId: null,
                    body: "<p>hi</p>",
                    editedAt: null,
                    deletedAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ])
        );

        const res = await request("POST", `/channels/${channelId}/messages`, { body: "<p>hi</p>" });
        const body = await res.json();

        expect(res.status).toBe(201);
        sendMessageResponseSchema.parse(body);
    });

    it("GET /channels/:channelId/messages/:messageId/thread", async () => {
        signedInAs();
        const channelId = uuid();
        const authorId = uuid();
        db.query.channels.findFirst.mockResolvedValueOnce(makeChannel());
        db.query.channelMembers.findFirst.mockResolvedValueOnce(undefined);
        db.query.messages.findFirst.mockResolvedValueOnce({ channelId, threadRootId: null });
        db.query.messages.findMany.mockResolvedValueOnce([
            {
                id: uuid(),
                channelId,
                authorUserId: authorId,
                type: "user",
                systemEvent: null,
                threadRootId: null,
                body: "<p>root</p>",
                editedAt: null,
                deletedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                author: { id: authorId, name: "Jamie", preferences: null },
                attachments: [],
                reactions: [],
                mentions: []
            }
        ]);

        const res = await request("GET", `/channels/${channelId}/messages/${uuid()}/thread`);
        const body = await res.json();

        expect(res.status).toBe(200);
        threadResponseSchema.parse(body);
    });

    it("error envelope shape (404)", async () => {
        signedInAs();
        db.query.channels.findFirst.mockResolvedValueOnce(undefined);

        const res = await request("GET", `/channels/${uuid()}`);
        const body = await res.json();

        expect(res.status).toBe(404);
        errorEnvelopeSchema.parse(body);
    });

    it("validation error envelope shape (422)", async () => {
        signedInAs();

        const res = await request("POST", "/channels", { name: "" });
        const body = await res.json();

        expect(res.status).toBe(422);
        errorEnvelopeSchema.parse(body);
        expect(body.error.issues.length).toBeGreaterThan(0);
    });

    it("204 responses carry no body", async () => {
        signedInAs();

        const res = await request("POST", `/channels/${uuid()}/read`);

        expect(res.status).toBe(204);
        expect(await res.text()).toBe("");
    });
});
