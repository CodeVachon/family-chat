"use server";

import { revalidatePath } from "next/cache";

import { authorizeChannel } from "@/lib/dal";
import {
    addMemberToChannel,
    removeMemberFromChannel,
    updateChannelMemberRole
} from "@/lib/services/channel-members";
import { channelMemberRoleSchema } from "@/lib/validation/channel";

function requireField(formData: FormData, key: string): string {
    const v = formData.get(key);
    if (typeof v !== "string" || v.length === 0) throw new Error(`Missing ${key}`);
    return v;
}

export async function addChannelMember(formData: FormData) {
    const channelId = requireField(formData, "channelId");
    const { user: actor } = await authorizeChannel(channelId, "channel:manage_members");

    const userId = requireField(formData, "userId");
    const role = channelMemberRoleSchema.parse(formData.get("role") ?? "user");

    await addMemberToChannel(channelId, userId, role, actor.id);

    revalidatePath(`/channels/${channelId}`);
}

export async function setChannelMemberRole(formData: FormData) {
    const channelId = requireField(formData, "channelId");
    await authorizeChannel(channelId, "channel:manage_members");

    const userId = requireField(formData, "userId");
    const role = channelMemberRoleSchema.parse(formData.get("role"));

    await updateChannelMemberRole(channelId, userId, role);

    revalidatePath(`/channels/${channelId}`);
}

export async function removeChannelMember(formData: FormData) {
    const channelId = requireField(formData, "channelId");
    const { user: actor } = await authorizeChannel(channelId, "channel:manage_members");

    const userId = requireField(formData, "userId");
    await removeMemberFromChannel(channelId, userId, actor.id);

    revalidatePath(`/channels/${channelId}`);
}
