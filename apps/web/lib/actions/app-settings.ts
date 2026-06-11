"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@workspace/db/client";
import { appSettings, channels } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";
import { isAppStaff } from "@/lib/permissions";
import { getBroker } from "@/lib/realtime/broker";

const appSettingsSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(60),
    iconUrl: z.string().url().nullable(),
    // Channels new users auto-join. Validated server-side to be existing public
    // channels (see below) — the client picker only offers public ones.
    defaultChannelIds: z.array(z.string().uuid()).max(50).default([])
});

export async function updateAppSettings(input: unknown) {
    const user = await requireApprovedUser();
    if (!isAppStaff(user)) throw new Error("Not authorized");

    const data = appSettingsSchema.parse(input);

    // Reject any default that isn't an existing public, non-archived channel —
    // private channels must never become defaults (they'd silently grant access).
    const defaultChannelIds = [...new Set(data.defaultChannelIds)];
    if (defaultChannelIds.length > 0) {
        const valid = await db.query.channels.findMany({
            where: and(
                inArray(channels.id, defaultChannelIds),
                eq(channels.isPrivate, false),
                eq(channels.isArchived, false)
            ),
            columns: { id: true }
        });
        if (valid.length !== defaultChannelIds.length) {
            throw new Error("Default channels must be existing public channels");
        }
    }

    await db
        .insert(appSettings)
        .values({ id: "app", name: data.name, iconUrl: data.iconUrl, defaultChannelIds })
        .onConflictDoUpdate({
            target: appSettings.id,
            set: {
                name: data.name,
                iconUrl: data.iconUrl,
                defaultChannelIds,
                updatedAt: new Date()
            }
        });

    revalidatePath("/", "layout");
    // Name/icon appear in every client's shell — sync everyone.
    getBroker().publishEphemeral({ type: "settings.changed", ts: Date.now() });
}
