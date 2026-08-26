import "server-only";

import { eq, like } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { user as userTable, verification } from "@workspace/db/schema";

import { auth } from "@/lib/auth";
import { joinDefaultChannels } from "@/lib/channels/default-channels";

import { ServiceError } from "./channel-members";

/**
 * Auto-join the default channels, best-effort. The approval/invite has already
 * committed by the time this runs and the join is idempotent, so a failure here
 * must not fail the whole caller (and re-approving safely retries).
 */
async function joinDefaultChannelsBestEffort(userId: string) {
    try {
        await joinDefaultChannels(userId);
    } catch (err) {
        console.error("[admin] default-channel auto-join failed", err);
    }
}

/** Reject if the target is the application owner (owner is untouchable here). */
async function assertNotOwner(targetUserId: string) {
    const target = await db.query.user.findFirst({
        where: eq(userTable.id, targetUserId),
        columns: { appRole: true }
    });
    if (target?.appRole === "owner") {
        throw new ServiceError("Cannot modify the application owner", 403);
    }
}

export type ApprovalStatus = "approved" | "pending" | "rejected";

/**
 * Transition a user's approval status, auto-joining default channels on
 * approval. Approving is intentionally exempt from the owner check — an owner
 * is always approved already, so this path never legitimately targets one.
 */
export async function setUserApprovalStatus(
    targetUserId: string,
    status: ApprovalStatus,
    actorId: string
) {
    if (status !== "approved") await assertNotOwner(targetUserId);

    await db
        .update(userTable)
        .set({
            approvalStatus: status,
            approvedAt: status === "approved" ? new Date() : null,
            approvedByUserId: status === "approved" ? actorId : null,
            updatedAt: new Date()
        })
        .where(eq(userTable.id, targetUserId));

    if (status === "approved") {
        // Newly approved users auto-join the configured default channels. The
        // membership inserts emit channels.changed, so the user's SSE fan-out
        // scope is re-resolved without a manual reconnect.
        await joinDefaultChannelsBestEffort(targetUserId);
    }
}

export type AppRole = "admin" | "user";

/** Promote/demote a user's app role. */
export async function setUserAppRole(targetUserId: string, role: AppRole) {
    await assertNotOwner(targetUserId);
    await db
        .update(userTable)
        .set({ appRole: role, updatedAt: new Date() })
        .where(eq(userTable.id, targetUserId));
}

export type InviteUserInput = { name: string; email: string };

/** Create an approved user and email them a magic sign-in link. */
export async function createInvitedUser(
    input: InviteUserInput,
    actorId: string,
    requestHeaders: Headers
): Promise<string> {
    const existing = await db.query.user.findFirst({
        where: eq(userTable.email, input.email),
        columns: { id: true }
    });
    if (existing) throw new ServiceError("A user with that email already exists", 409);

    const userId = crypto.randomUUID();
    await db.insert(userTable).values({
        id: userId,
        name: input.name,
        email: input.email,
        emailVerified: true,
        appRole: "user",
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedByUserId: actorId
    });

    // Send the invite atomically with creation: if the email fails, roll back so
    // we never leave an orphaned approved account the caller thinks was never
    // created, nor a live magic-link token for it.
    try {
        await auth.api.signInMagicLink({
            body: { email: input.email, callbackURL: "/" },
            headers: requestHeaders
        });
    } catch (err) {
        // Cleanup runs in its own try so a cleanup failure can't mask (replace)
        // the original send error the caller needs to see.
        try {
            await db.delete(userTable).where(eq(userTable.id, userId));
            // Better-Auth writes the magic-link token row *before* sending, keyed
            // by a random token with the email embedded in its JSON `value`
            // (`{"email":"..."}`). Match on that; anchored quotes avoid
            // substring collisions and LIKE wildcards in the address are escaped
            // (Postgres LIKE's default escape is backslash).
            const emailPattern = `%"email":"${input.email.replace(/[\\%_]/g, "\\$&")}"%`;
            await db.delete(verification).where(like(verification.value, emailPattern));
        } catch {
            /* best-effort cleanup — surface the original send error below */
        }
        throw err;
    }

    // Invited users are created already-approved, so they bypass setUserApprovalStatus —
    // auto-join the default channels here too.
    await joinDefaultChannelsBestEffort(userId);

    return userId;
}
