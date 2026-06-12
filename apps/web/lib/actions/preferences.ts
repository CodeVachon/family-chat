"use server";

import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { userPreferences } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";
import { getBroker } from "@/lib/realtime/broker";
import {
    appearancePrefsSchema,
    avatarPrefsSchema,
    notificationPrefsSchema,
    profilePrefsSchema
} from "@/lib/validation/preferences";

async function upsertPreferences(userId: string, values: Record<string, unknown>) {
    // Only write keys that were actually provided. A field omitted from the
    // payload (e.g. a stale client bundle) must not overwrite the stored value
    // with null; an explicit null (a cleared field) is kept and does clear it.
    const set = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
    await db
        .insert(userPreferences)
        .values({ userId, ...set })
        .onConflictDoUpdate({
            target: userPreferences.userId,
            set: { ...set, updatedAt: new Date() }
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

/**
 * Persist just the avatar (its delivery URL + the raw source/crop kept for
 * re-editing). The avatar editor's "Save crop"/"Remove" commit immediately via
 * this, independently of the profile form's "Save changes" — and since only
 * these three keys are written, the other profile fields are never touched.
 */
export async function updateAvatar(input: unknown) {
    const data = avatarPrefsSchema.parse(input);
    const user = await requireApprovedUser();
    await upsertPreferences(user.id, data);
    revalidatePath("/", "layout");
    getBroker().publishEphemeral({ type: "users.changed", ts: Date.now() });
}

export async function updateAppearance(input: unknown) {
    const data = appearancePrefsSchema.parse(input);
    const user = await requireApprovedUser();
    await upsertPreferences(user.id, data);
    revalidatePath("/", "layout");
}

export async function updateNotifications(input: unknown) {
    const data = notificationPrefsSchema.parse(input);
    const user = await requireApprovedUser();
    await upsertPreferences(user.id, data);
    revalidatePath("/", "layout");
}
