import { beforeEach, describe, expect, it } from "bun:test";

import { auth, resetAuth } from "../../test/mocks/auth";
import { chain } from "../../test/mocks/chain";
import { db, resetDb } from "../../test/mocks/db";
import { joinDefaultChannels, resetDefaultChannels } from "../../test/mocks/default-channels";

import { createInvitedUser, setUserAppRole, setUserApprovalStatus } from "./admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
    resetDb();
    resetAuth();
    resetDefaultChannels();
});

describe("setUserApprovalStatus", () => {
    it("throws 403 when rejecting the application owner", async () => {
        db.query.user.findFirst.mockResolvedValueOnce({ appRole: "owner" });

        await expect(setUserApprovalStatus("owner-1", "rejected", "actor-1")).rejects.toMatchObject({
            message: "Cannot modify the application owner",
            status: 403
        });
        expect(db.update).not.toHaveBeenCalled();
    });

    it("approves without an owner check and auto-joins default channels", async () => {
        await setUserApprovalStatus("u1", "approved", "actor-1");

        // Approving is exempt from assertNotOwner, so the owner lookup never runs.
        expect(db.query.user.findFirst).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalledTimes(1);
        expect(joinDefaultChannels).toHaveBeenCalledWith("u1");
    });

    it("rejects a non-owner target without auto-joining", async () => {
        db.query.user.findFirst.mockResolvedValueOnce({ appRole: "user" });

        await setUserApprovalStatus("u1", "rejected", "actor-1");

        expect(db.update).toHaveBeenCalledTimes(1);
        expect(joinDefaultChannels).not.toHaveBeenCalled();
    });
});

describe("setUserAppRole", () => {
    it("throws 403 when targeting the application owner", async () => {
        db.query.user.findFirst.mockResolvedValueOnce({ appRole: "owner" });

        await expect(setUserAppRole("owner-1", "admin")).rejects.toMatchObject({
            message: "Cannot modify the application owner",
            status: 403
        });
        expect(db.update).not.toHaveBeenCalled();
    });

    it("updates the role for a non-owner target", async () => {
        db.query.user.findFirst.mockResolvedValueOnce({ appRole: "user" });

        await setUserAppRole("u1", "admin");

        expect(db.update).toHaveBeenCalledTimes(1);
    });
});

describe("createInvitedUser", () => {
    const headers = new Headers();

    it("throws 409 when a user with that email already exists", async () => {
        db.query.user.findFirst.mockResolvedValueOnce({ id: "existing" });

        await expect(
            createInvitedUser({ name: "Jo", email: "jo@example.com" }, "actor-1", headers)
        ).rejects.toMatchObject({
            message: "A user with that email already exists",
            status: 409
        });
        expect(db.insert).not.toHaveBeenCalled();
    });

    it("creates an approved user, sends a magic link, and auto-joins default channels", async () => {
        db.query.user.findFirst.mockResolvedValueOnce(undefined);
        const insertChain = chain([]);
        db.insert.mockReturnValueOnce(insertChain);

        const userId = await createInvitedUser({ name: "Jo", email: "jo@example.com" }, "actor-1", headers);

        expect(userId).toMatch(UUID_RE);
        expect(insertChain.values).toHaveBeenCalledWith(
            expect.objectContaining({
                id: userId,
                email: "jo@example.com",
                approvalStatus: "approved"
            })
        );
        expect(auth.api.signInMagicLink).toHaveBeenCalledWith(
            expect.objectContaining({ body: expect.objectContaining({ email: "jo@example.com" }) })
        );
        expect(joinDefaultChannels).toHaveBeenCalledWith(userId);
        expect(db.delete).not.toHaveBeenCalled();
    });

    it("rolls back the created user and verification token when the magic link send fails", async () => {
        db.query.user.findFirst.mockResolvedValueOnce(undefined);
        db.insert.mockReturnValueOnce(chain([]));
        auth.api.signInMagicLink.mockRejectedValueOnce(new Error("send failed"));

        await expect(
            createInvitedUser({ name: "Jo", email: "jo@example.com" }, "actor-1", headers)
        ).rejects.toThrow("send failed");

        expect(db.delete).toHaveBeenCalledTimes(2);
        expect(joinDefaultChannels).not.toHaveBeenCalled();
    });
});
