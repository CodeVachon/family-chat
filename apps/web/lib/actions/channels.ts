"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { channelMembers, channels } from "@workspace/db/schema";

import { authorizeChannel, requireApprovedUser } from "@/lib/dal";
import { canApp } from "@/lib/permissions";
import { channelFormSchema } from "@/lib/validation/channel";

function parseChannelForm(formData: FormData) {
    return channelFormSchema.parse({
        name: formData.get("name"),
        description: formData.get("description") ?? undefined,
        color: formData.get("color") || undefined,
        icon: formData.get("icon") || undefined,
        isPrivate: formData.get("isPrivate") === "on" || formData.get("isPrivate") === "true"
    });
}

function requireChannelId(formData: FormData): string {
    const id = formData.get("channelId");
    if (typeof id !== "string" || id.length === 0) throw new Error("Missing channel id");
    return id;
}

export async function createChannel(formData: FormData) {
    const actor = await requireApprovedUser();
    if (!canApp(actor, "channel:create")) throw new Error("Not authorized");

    const input = parseChannelForm(formData);

    const channelId = await db.transaction(async (tx) => {
        const [channel] = await tx
            .insert(channels)
            .values({
                name: input.name,
                description: input.description,
                color: input.color,
                icon: input.icon,
                isPrivate: input.isPrivate,
                createdByUserId: actor.id
            })
            .returning({ id: channels.id });

        // The creator becomes the channel Owner.
        await tx.insert(channelMembers).values({
            channelId: channel!.id,
            userId: actor.id,
            role: "owner"
        });

        return channel!.id;
    });

    revalidatePath("/channels");
    redirect(`/channels/${channelId}`);
}

export async function updateChannel(formData: FormData) {
    const channelId = requireChannelId(formData);
    await authorizeChannel(channelId, "channel:edit_settings");

    const input = parseChannelForm(formData);
    await db
        .update(channels)
        .set({
            name: input.name,
            description: input.description,
            color: input.color,
            icon: input.icon,
            isPrivate: input.isPrivate,
            updatedAt: new Date()
        })
        .where(eq(channels.id, channelId));

    revalidatePath("/channels");
    revalidatePath(`/channels/${channelId}`);
}

export async function setChannelArchived(formData: FormData) {
    const channelId = requireChannelId(formData);
    await authorizeChannel(channelId, "channel:archive");

    const archived = formData.get("archived") === "true";
    await db
        .update(channels)
        .set({
            isArchived: archived,
            archivedAt: archived ? new Date() : null,
            updatedAt: new Date()
        })
        .where(eq(channels.id, channelId));

    revalidatePath("/channels");
    revalidatePath(`/channels/${channelId}`);
}

export async function deleteChannel(formData: FormData) {
    const channelId = requireChannelId(formData);
    await authorizeChannel(channelId, "channel:delete");

    await db.delete(channels).where(eq(channels.id, channelId));

    revalidatePath("/channels");
    redirect("/channels");
}

export async function joinChannel(formData: FormData) {
    const actor = await requireApprovedUser();
    const channelId = requireChannelId(formData);

    const channel = await db.query.channels.findFirst({ where: eq(channels.id, channelId) });
    if (!channel) throw new Error("Channel not found");
    if (channel.isPrivate) throw new Error("Cannot join a private channel");

    await db
        .insert(channelMembers)
        .values({ channelId, userId: actor.id, role: "user" })
        .onConflictDoNothing();

    revalidatePath("/channels");
    revalidatePath(`/channels/${channelId}`);
}

export async function leaveChannel(formData: FormData) {
    const actor = await requireApprovedUser();
    const channelId = requireChannelId(formData);

    const membership = await db.query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, actor.id))
    });
    if (membership?.role === "owner") {
        throw new Error("The channel owner cannot leave; transfer ownership or delete it");
    }

    await db
        .delete(channelMembers)
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, actor.id)));

    revalidatePath("/channels");
    revalidatePath(`/channels/${channelId}`);
}
