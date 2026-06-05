"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { user as userTable } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";
import { canApp, type AppAction } from "@/lib/permissions";

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
}

/** Reject if the target is the application owner (owner is untouchable here). */
async function assertNotOwner(targetUserId: string) {
    const target = await db.query.user.findFirst({
        where: eq(userTable.id, targetUserId),
        columns: { appRole: true }
    });
    if (target?.appRole === "owner") {
        throw new Error("Cannot modify the application owner");
    }
}

export async function approveUser(formData: FormData) {
    await adminAction("user:approve", formData, async (targetUserId, actorId) => {
        await db
            .update(userTable)
            .set({
                approvalStatus: "approved",
                approvedAt: new Date(),
                approvedByUserId: actorId,
                updatedAt: new Date()
            })
            .where(eq(userTable.id, targetUserId));
    });
}

export async function rejectUser(formData: FormData) {
    await adminAction("user:reject", formData, async (targetUserId) => {
        await assertNotOwner(targetUserId);
        await db
            .update(userTable)
            .set({ approvalStatus: "rejected", updatedAt: new Date() })
            .where(eq(userTable.id, targetUserId));
    });
}

export async function promoteToAdmin(formData: FormData) {
    await adminAction("user:promote_admin", formData, async (targetUserId) => {
        await assertNotOwner(targetUserId);
        await db
            .update(userTable)
            .set({ appRole: "admin", updatedAt: new Date() })
            .where(eq(userTable.id, targetUserId));
    });
}

export async function demoteToUser(formData: FormData) {
    await adminAction("user:demote", formData, async (targetUserId) => {
        await assertNotOwner(targetUserId);
        await db
            .update(userTable)
            .set({ appRole: "user", updatedAt: new Date() })
            .where(eq(userTable.id, targetUserId));
    });
}
