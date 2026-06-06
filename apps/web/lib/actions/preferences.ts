"use server";

import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { userPreferences } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";
import { getBroker } from "@/lib/realtime/broker";
import { appearancePrefsSchema, profilePrefsSchema } from "@/lib/validation/preferences";

async function upsertPreferences(userId: string, values: Record<string, unknown>) {
    await db
        .insert(userPreferences)
        .values({ userId, ...values })
        .onConflictDoUpdate({
            target: userPreferences.userId,
            set: { ...values, updatedAt: new Date() }
        });
}

export async function updateProfile(input: unknown) {
    const data = profilePrefsSchema.parse(input);
    const user = await requireApprovedUser();
    await upsertPreferences(user.id, data);
    // Name/color/avatar appear in the shell and on the user's own messages.
    revalidatePath("/", "layout");
    // Identity changes affect how this user looks to everyone — sync all clients.
    getBroker().publishEphemeral({ type: "users.changed", ts: Date.now() });
}

export async function updateAppearance(input: unknown) {
    const data = appearancePrefsSchema.parse(input);
    const user = await requireApprovedUser();
    await upsertPreferences(user.id, data);
    revalidatePath("/", "layout");
}
