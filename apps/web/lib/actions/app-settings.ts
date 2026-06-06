"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@workspace/db/client";
import { appSettings } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";
import { isAppStaff } from "@/lib/permissions";
import { getBroker } from "@/lib/realtime/broker";

const appSettingsSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(60),
    iconUrl: z.string().url().nullable()
});

export async function updateAppSettings(input: unknown) {
    const user = await requireApprovedUser();
    if (!isAppStaff(user)) throw new Error("Not authorized");

    const data = appSettingsSchema.parse(input);
    await db
        .insert(appSettings)
        .values({ id: "app", name: data.name, iconUrl: data.iconUrl })
        .onConflictDoUpdate({
            target: appSettings.id,
            set: { name: data.name, iconUrl: data.iconUrl, updatedAt: new Date() }
        });

    revalidatePath("/", "layout");
    // Name/icon appear in every client's shell — sync everyone.
    getBroker().publishEphemeral({ type: "settings.changed", ts: Date.now() });
}
