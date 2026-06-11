"use server";

import { eq, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@workspace/db/client";
import { user as userTable, verification } from "@workspace/db/schema";

import { auth } from "@/lib/auth";
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

/** Revoke a user's approval, sending them back to the pending state. */
export async function unapproveUser(formData: FormData) {
    await adminAction("user:reject", formData, async (targetUserId) => {
        await assertNotOwner(targetUserId);
        await db
            .update(userTable)
            .set({
                approvalStatus: "pending",
                approvedAt: null,
                approvedByUserId: null,
                updatedAt: new Date()
            })
            .where(eq(userTable.id, targetUserId));
    });
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

    const existing = await db.query.user.findFirst({
        where: eq(userTable.email, data.email),
        columns: { id: true }
    });
    if (existing) throw new Error("A user with that email already exists");

    const userId = crypto.randomUUID();
    await db.insert(userTable).values({
        id: userId,
        name: data.name,
        email: data.email,
        emailVerified: true,
        appRole: "user",
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedByUserId: actor.id
    });

    // Send the invite atomically with creation: if the email fails, roll back so
    // we never leave an orphaned approved account the admin thinks was never
    // created, nor a live magic-link token for it.
    try {
        await auth.api.signInMagicLink({
            body: { email: data.email, callbackURL: "/" },
            headers: await headers()
        });
    } catch (err) {
        // Cleanup runs in its own try so a cleanup failure can't mask (replace)
        // the original send error the admin needs to see.
        try {
            await db.delete(userTable).where(eq(userTable.id, userId));
            // Better-Auth writes the magic-link token row *before* sending, keyed
            // by a random token with the email embedded in its JSON `value`
            // (`{"email":"..."}`). Match on that; anchored quotes avoid
            // substring collisions and LIKE wildcards in the address are escaped
            // (Postgres LIKE's default escape is backslash).
            const emailPattern = `%"email":"${data.email.replace(/[\\%_]/g, "\\$&")}"%`;
            await db.delete(verification).where(like(verification.value, emailPattern));
        } catch {
            /* best-effort cleanup — surface the original send error below */
        }
        throw err;
    }

    revalidatePath("/admin/users");
    revalidatePath("/admin/approvals");
}
