"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@workspace/db/client";
import { appSettings } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";
import { isAppStaff } from "@/lib/permissions";
import { getBroker } from "@/lib/realtime/broker";
import { validateDefaultChannelIds } from "@/lib/services/app-settings";

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

    const defaultChannelIds = await validateDefaultChannelIds(data.defaultChannelIds);

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
