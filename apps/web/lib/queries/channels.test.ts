import { beforeEach, describe, expect, it } from "bun:test";

import { chain } from "../../test/mocks/chain";
import { db, resetDb } from "../../test/mocks/db";

import { listChannelMessages } from "./channels";

const author = { id: "u2", name: "Sam", preferences: null };

function rootRow(id: string) {
    return {
        id,
        channelId: "c1",
        authorUserId: "u2",
        type: "user",
        body: "hi",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        author,
        attachments: [],
        reactions: [],
        mentions: []
    };
}

/** The reply aggregate is the only select() listChannelMessages issues. */
function mockReplyAgg(rows: unknown[]) {
    db.select.mockImplementation(() => chain(rows));
}

beforeEach(() => {
    resetDb();
});

describe("listChannelMessages unreadReplyCount", () => {
    it("surfaces the per-root unread reply count from the aggregate", async () => {
        db.query.messages.findMany.mockResolvedValueOnce([rootRow("m2"), rootRow("m1")]);
        db.query.channelMembers.findFirst.mockResolvedValueOnce({
            lastReadAt: new Date("2026-01-01T00:00:00Z")
        });
        mockReplyAgg([
            { rootId: "m1", count: 3, unread: 2, last: "2026-01-02T00:00:00Z" },
            { rootId: "m2", count: 1, unread: 0, last: "2026-01-01T00:00:00Z" }
        ]);

        const result = await listChannelMessages("c1", "u1");

        expect(result.map((m) => [m.id, m.replyCount, m.unreadReplyCount])).toEqual([
            ["m1", 3, 2],
            ["m2", 1, 0]
        ]);
    });

    it("reports zero unread replies for a root with no thread", async () => {
        db.query.messages.findMany.mockResolvedValueOnce([rootRow("m1")]);
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ lastReadAt: null });
        mockReplyAgg([]);

        const [m] = await listChannelMessages("c1", "u1");

        expect(m!.replyCount).toBe(0);
        expect(m!.unreadReplyCount).toBe(0);
    });

    it("looks up the read marker once, and only when there are messages", async () => {
        db.query.messages.findMany.mockResolvedValueOnce([rootRow("m1")]);
        mockReplyAgg([]);
        await listChannelMessages("c1", "u1");
        expect(db.query.channelMembers.findFirst).toHaveBeenCalledTimes(1);

        db.query.channelMembers.findFirst.mockClear();
        db.query.messages.findMany.mockResolvedValueOnce([]);
        await listChannelMessages("c1", "u1");
        expect(db.query.channelMembers.findFirst).not.toHaveBeenCalled();
    });
});
