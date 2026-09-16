import { beforeEach, describe, expect, it } from "bun:test";

import { chain } from "../../test/mocks/chain";
import { db } from "../../test/mocks/db";
import { makeChannel, request, resetAllMocks, signedInAs, uuid } from "../../test/helpers/api-v1";

beforeEach(resetAllMocks);

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
