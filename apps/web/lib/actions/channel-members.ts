"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { channelMembers, user } from "@workspace/db/schema";

import { authorizeChannel } from "@/lib/dal";
import { insertSystemMessage } from "@/lib/messaging/system-messages";
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
    const { user: actor } = await authorizeChannel(channelId, "channel:manage_members");

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

    await db.transaction(async (tx) => {
        const inserted = await tx
            .insert(channelMembers)
            .values({ channelId, userId, role })
            .onConflictDoNothing()
            .returning({ id: channelMembers.id });
        // Announce only on a real join (not a no-op when already a member).
        if (inserted.length > 0) {
            await insertSystemMessage(tx, {
                channelId,
                event: "join",
                subjectUserId: userId,
                actorUserId: actor.id
            });
        }
    });

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
    const { user: actor } = await authorizeChannel(channelId, "channel:manage_members");

    const userId = requireField(formData, "userId");
    await assertTargetNotOwner(channelId, userId);
    await db.transaction(async (tx) => {
        const removed = await tx
            .delete(channelMembers)
            .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
            .returning({ id: channelMembers.id });
        // Announce only if a membership was actually removed.
        if (removed.length > 0) {
            await insertSystemMessage(tx, {
                channelId,
                event: "leave",
                subjectUserId: userId,
                actorUserId: actor.id
            });
        }
    });

    revalidatePath(`/channels/${channelId}`);
}
