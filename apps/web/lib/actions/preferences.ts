"use server";

import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { userPreferences } from "@workspace/db/schema";

import { type ActionResult, parseInput } from "@/lib/actions/result";
import { requireApprovedUser } from "@/lib/dal";
import { getBroker } from "@/lib/realtime/broker";
import {
    appearancePrefsSchema,
    avatarPrefsSchema,
    bannerPrefsSchema,
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

/**
 * Shared tail for the preference actions: validate, require the user, write only
 * the provided keys, and revalidate the (server-rendered) shell. A validation
 * failure short-circuits and is handed straight back to the caller so it can
 * show the message — never thrown (see `parseInput`). `syncUsers` is set for
 * identity-visible changes (name/color/avatar/banner), which must be pushed to
 * every client; appearance/notifications are personal-only.
 */
async function commitPreferences(
    parsed: ActionResult<Record<string, unknown>>,
    { syncUsers }: { syncUsers: boolean }
): Promise<ActionResult> {
    if (!parsed.ok) return parsed;
    const user = await requireApprovedUser();
    await upsertPreferences(user.id, parsed.data);
    revalidatePath("/", "layout");
    if (syncUsers) getBroker().publishEphemeral({ type: "users.changed", ts: Date.now() });
    return { ok: true, data: undefined };
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
    return commitPreferences(parseInput(profilePrefsSchema, input), { syncUsers: true });
}

/**
 * Persist just the avatar (its delivery URL + the raw source/crop kept for
 * re-editing). The avatar editor's "Save crop"/"Remove" commit immediately via
 * this, independently of the profile form's "Save changes" — and since only
 * these three keys are written, the other profile fields are never touched.
 */
export async function updateAvatar(input: unknown): Promise<ActionResult> {
    return commitPreferences(parseInput(avatarPrefsSchema, input), { syncUsers: true });
}

/**
 * Persist just the banner (its delivery URL + the raw source/crop kept for
 * re-editing), mirroring `updateAvatar`. The banner editor's "Save crop" /
 * "Remove" commit immediately via this, independently of the profile form's
 * "Save changes", and only these three keys are written.
 */
export async function updateBanner(input: unknown): Promise<ActionResult> {
    return commitPreferences(parseInput(bannerPrefsSchema, input), { syncUsers: true });
}

export async function updateAppearance(input: unknown): Promise<ActionResult> {
    return commitPreferences(parseInput(appearancePrefsSchema, input), { syncUsers: false });
}

export async function updateNotifications(input: unknown): Promise<ActionResult> {
    return commitPreferences(parseInput(notificationPrefsSchema, input), { syncUsers: false });
}
