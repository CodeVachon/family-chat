"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireApprovedUser } from "@/lib/dal";
import { canApp, type AppAction } from "@/lib/permissions";
import { getBroker } from "@/lib/realtime/broker";
import { createInvitedUser, setUserApprovalStatus, setUserAppRole } from "@/lib/services/admin";

function getUserId(formData: FormData): string {
    const id = formData.get("userId");
    if (typeof id !== "string" || id.length === 0) {
        throw new Error("Missing user id");
    }
    return id;
}

/** Authorize, run the mutation, and revalidate the admin views. */
async function adminAction(
    action: AppAction,
    formData: FormData,
    run: (targetUserId: string, actorId: string) => Promise<void>
) {
    const actor = await requireApprovedUser();
    if (!canApp(actor, action)) throw new Error("Not authorized");
    await run(getUserId(formData), actor.id);
    revalidatePath("/admin/approvals");
    revalidatePath("/admin/users");
    // Membership/approval changed — refresh every client's shell so the staff
    // pending-approvals badge (and member lists) stay current.
    getBroker().publishEphemeral({ type: "users.changed", ts: Date.now() });
}

export async function approveUser(formData: FormData) {
    await adminAction("user:approve", formData, (targetUserId, actorId) =>
        setUserApprovalStatus(targetUserId, "approved", actorId)
    );
}

export async function rejectUser(formData: FormData) {
    await adminAction("user:reject", formData, (targetUserId, actorId) =>
        setUserApprovalStatus(targetUserId, "rejected", actorId)
    );
}

export async function promoteToAdmin(formData: FormData) {
    await adminAction("user:promote_admin", formData, (targetUserId) =>
        setUserAppRole(targetUserId, "admin")
    );
}

export async function demoteToUser(formData: FormData) {
    await adminAction("user:demote", formData, (targetUserId) =>
        setUserAppRole(targetUserId, "user")
    );
}

/** Revoke a user's approval, sending them back to the pending state. */
export async function unapproveUser(formData: FormData) {
    await adminAction("user:reject", formData, (targetUserId, actorId) =>
        setUserApprovalStatus(targetUserId, "pending", actorId)
    );
}

const inviteSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(80),
    email: z.email("Enter a valid email").transform((v) => v.toLowerCase())
});

/** Create an approved user and email them a magic sign-in link. */
export async function inviteUser(input: unknown) {
    const actor = await requireApprovedUser();
    if (!canApp(actor, "user:approve")) throw new Error("Not authorized");

    const data = inviteSchema.parse(input);
    await createInvitedUser(data, actor.id, await headers());

    revalidatePath("/admin/users");
    revalidatePath("/admin/approvals");
    getBroker().publishEphemeral({ type: "users.changed", ts: Date.now() });
}
