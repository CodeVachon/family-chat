import { beforeEach, describe, expect, it } from "bun:test";

import { chain } from "../../test/mocks/chain";
import { db, resetDb } from "../../test/mocks/db";
import { insertSystemMessage, resetSystemMessages } from "../../test/mocks/system-messages";

import {
    addMemberToChannel,
    getChannelMembership,
    joinPublicChannel,
    leaveChannelMembership,
    recordChannelRead,
    removeMemberFromChannel,
    ServiceError,
    updateChannelMemberRole
} from "./channel-members";

beforeEach(() => {
    resetDb();
    resetSystemMessages();
});

describe("ServiceError", () => {
    it("defaults to a 400 status", () => {
        const err = new ServiceError("bad input");
        expect(err.status).toBe(400);
        expect(err.message).toBe("bad input");
    });

    it("accepts a custom status", () => {
        const err = new ServiceError("not found", 404);
        expect(err.status).toBe(404);
    });
});

describe("getChannelMembership", () => {
    it("returns whatever the membership lookup resolves", async () => {
        const membership = { channelId: "c1", userId: "u1", role: "user" };
        db.query.channelMembers.findFirst.mockResolvedValueOnce(membership);

        await expect(getChannelMembership("c1", "u1")).resolves.toMatchObject(membership);
    });
});

describe("joinPublicChannel", () => {
    it("throws 404 when the channel does not exist", async () => {
        db.query.channels.findFirst.mockResolvedValueOnce(undefined);

        await expect(joinPublicChannel("missing", "u1")).rejects.toMatchObject({
            message: "Channel not found",
            status: 404
        });
    });

    it("throws 403 when the channel is private", async () => {
        db.query.channels.findFirst.mockResolvedValueOnce({ id: "c1", isPrivate: true });

        await expect(joinPublicChannel("c1", "u1")).rejects.toMatchObject({
            message: "Cannot join a private channel",
            status: 403
        });
    });

    it("inserts a membership and announces a join for a new member", async () => {
        db.query.channels.findFirst.mockResolvedValueOnce({ id: "c1", isPrivate: false });
        db.insert.mockReturnValueOnce(chain([{ id: "member-1" }]));

        await joinPublicChannel("c1", "u1");

        expect(db.insert).toHaveBeenCalledTimes(1);
        expect(insertSystemMessage).toHaveBeenCalledTimes(1);
        expect(insertSystemMessage).toHaveBeenCalledWith(
            db,
            expect.objectContaining({
                channelId: "c1",
                event: "join",
                subjectUserId: "u1",
                actorUserId: "u1"
            })
        );
    });

    it("does not announce a join when already a member (conflict no-op)", async () => {
        db.query.channels.findFirst.mockResolvedValueOnce({ id: "c1", isPrivate: false });
        db.insert.mockReturnValueOnce(chain([]));

        await joinPublicChannel("c1", "u1");

        expect(insertSystemMessage).not.toHaveBeenCalled();
    });
});

describe("leaveChannelMembership", () => {
    it("throws 409 when the caller is the channel owner", async () => {
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "owner" });

        await expect(leaveChannelMembership("c1", "owner-1")).rejects.toMatchObject({
            message: "The channel owner cannot leave; transfer ownership or delete it",
            status: 409
        });
        expect(db.delete).not.toHaveBeenCalled();
    });

    it("removes the membership and announces a leave for a non-owner", async () => {
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
        db.delete.mockReturnValueOnce(chain([{ id: "member-1" }]));

        await leaveChannelMembership("c1", "u1");

        expect(db.delete).toHaveBeenCalledTimes(1);
        expect(insertSystemMessage).toHaveBeenCalledWith(
            db,
            expect.objectContaining({
                channelId: "c1",
                event: "leave",
                subjectUserId: "u1",
                actorUserId: "u1"
            })
        );
    });

    it("skips the announcement when there was nothing to remove", async () => {
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
        db.delete.mockReturnValueOnce(chain([]));

        await leaveChannelMembership("c1", "u1");

        expect(insertSystemMessage).not.toHaveBeenCalled();
    });
});

describe("addMemberToChannel", () => {
    it("throws 422 when the target user does not exist", async () => {
        db.query.user.findFirst.mockResolvedValueOnce(undefined);

        await expect(addMemberToChannel("c1", "ghost", "user", "actor-1")).rejects.toMatchObject({
            message: "User must be an approved member",
            status: 422
        });
    });

    it("throws 422 when the target user is not approved", async () => {
        db.query.user.findFirst.mockResolvedValueOnce({ approvalStatus: "pending" });

        await expect(addMemberToChannel("c1", "u1", "user", "actor-1")).rejects.toMatchObject({
            status: 422
        });
    });

    it("adds an approved user and announces a join", async () => {
        db.query.user.findFirst.mockResolvedValueOnce({ approvalStatus: "approved" });
        db.insert.mockReturnValueOnce(chain([{ id: "member-1" }]));

        await addMemberToChannel("c1", "u1", "admin", "actor-1");

        expect(insertSystemMessage).toHaveBeenCalledWith(
            db,
            expect.objectContaining({
                channelId: "c1",
                event: "join",
                subjectUserId: "u1",
                actorUserId: "actor-1"
            })
        );
    });
});

describe("updateChannelMemberRole", () => {
    it("throws 409 when the target is the channel owner", async () => {
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "owner" });

        await expect(updateChannelMemberRole("c1", "owner-1", "admin")).rejects.toMatchObject({
            message: "Cannot modify the channel owner",
            status: 409
        });
        expect(db.update).not.toHaveBeenCalled();
    });

    it("updates the role for a non-owner target", async () => {
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });

        await updateChannelMemberRole("c1", "u1", "admin");

        expect(db.update).toHaveBeenCalledTimes(1);
    });
});

describe("removeMemberFromChannel", () => {
    it("throws 409 when the target is the channel owner", async () => {
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "owner" });

        await expect(removeMemberFromChannel("c1", "owner-1", "actor-1")).rejects.toMatchObject({
            status: 409
        });
        expect(db.delete).not.toHaveBeenCalled();
    });

    it("removes a non-owner target and announces a leave", async () => {
        db.query.channelMembers.findFirst.mockResolvedValueOnce({ role: "user" });
        db.delete.mockReturnValueOnce(chain([{ id: "member-1" }]));

        await removeMemberFromChannel("c1", "u1", "actor-1");

        expect(insertSystemMessage).toHaveBeenCalledWith(
            db,
            expect.objectContaining({
                channelId: "c1",
                event: "leave",
                subjectUserId: "u1",
                actorUserId: "actor-1"
            })
        );
    });
});

describe("recordChannelRead", () => {
    it("marks the latest message as read when one exists", async () => {
        db.query.messages.findFirst.mockResolvedValueOnce({ id: "msg-9" });
        const updateChain = chain(undefined);
        db.update.mockReturnValueOnce(updateChain);

        await recordChannelRead("c1", "u1");

        expect(updateChain.set).toHaveBeenCalledWith(
            expect.objectContaining({ lastReadMessageId: "msg-9" })
        );
    });

    it("clears lastReadMessageId when the channel has no messages", async () => {
        db.query.messages.findFirst.mockResolvedValueOnce(undefined);
        const updateChain = chain(undefined);
        db.update.mockReturnValueOnce(updateChain);

        await recordChannelRead("c1", "u1");

        expect(updateChain.set).toHaveBeenCalledWith(
            expect.objectContaining({ lastReadMessageId: null })
        );
    });
});
