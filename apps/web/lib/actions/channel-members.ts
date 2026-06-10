"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { channelMembers, user } from "@workspace/db/schema";

import { authorizeChannel } from "@/lib/dal";
import { channelMemberRoleSchema } from "@/lib/validation/channel";

function requireField(formData: FormData, key: string): string {
    const v = formData.get(key);
    if (typeof v !== "string" || v.length === 0) throw new Error(`Missing ${key}`);
    return v;
}

/** Owner memberships are managed via the create/transfer flow, never here. */
async function assertTargetNotOwner(channelId: string, userId: string) {
    const target = await db.query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)),
        columns: { role: true }
    });
    if (target?.role === "owner") {
        throw new Error("Cannot modify the channel owner");
    }
}

export async function addChannelMember(formData: FormData) {
    const channelId = requireField(formData, "channelId");
    await authorizeChannel(channelId, "channel:manage_members");

    const userId = requireField(formData, "userId");
    const role = channelMemberRoleSchema.parse(formData.get("role") ?? "user");

    // Only add real, approved users. A pending/rejected/stale id would otherwise
    // appear in member lists and mention targets and — if later approved —
    // silently gain access that was granted while it was not approved.
    const target = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { approvalStatus: true }
    });
    if (!target || target.approvalStatus !== "approved") {
        throw new Error("User must be an approved member");
    }

    await db.insert(channelMembers).values({ channelId, userId, role }).onConflictDoNothing();

    revalidatePath(`/channels/${channelId}`);
}

export async function setChannelMemberRole(formData: FormData) {
    const channelId = requireField(formData, "channelId");
    await authorizeChannel(channelId, "channel:manage_members");

    const userId = requireField(formData, "userId");
    const role = channelMemberRoleSchema.parse(formData.get("role"));

    await assertTargetNotOwner(channelId, userId);
    await db
        .update(channelMembers)
        .set({ role, updatedAt: new Date() })
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));

    revalidatePath(`/channels/${channelId}`);
}

export async function removeChannelMember(formData: FormData) {
    const channelId = requireField(formData, "channelId");
    await authorizeChannel(channelId, "channel:manage_members");

    const userId = requireField(formData, "userId");
    await assertTargetNotOwner(channelId, userId);
    await db
        .delete(channelMembers)
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));

    revalidatePath(`/channels/${channelId}`);
}
