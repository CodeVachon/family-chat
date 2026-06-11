import "server-only";

import { and, count, eq, inArray } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { appSettings, channelMembers, channels, user } from "@workspace/db/schema";

/**
 * Add a user to every configured default channel. Called when a user gains
 * access for the first time (on approval). Defensive on every front:
 *   - reads the current default set fresh,
 *   - prunes to channels that still exist and are public + non-archived (an
 *     admin can't grant private-channel access this way, and stale ids from a
 *     deleted/archived channel are skipped),
 *   - inserts idempotently, so re-approval never duplicates memberships.
 */
export async function joinDefaultChannels(userId: string): Promise<void> {
    const settings = await db.query.appSettings.findFirst({
        where: eq(appSettings.id, "app"),
        columns: { defaultChannelIds: true }
    });
    const ids = settings?.defaultChannelIds ?? [];
    if (ids.length === 0) return;

    const valid = await db.query.channels.findMany({
        where: and(
            inArray(channels.id, ids),
            eq(channels.isPrivate, false),
            eq(channels.isArchived, false)
        ),
        columns: { id: true }
    });
    // Surface a misconfigured default set (e.g. an admin archived/deleted a
    // default channel without updating settings) rather than silently joining
    // users to fewer channels than configured.
    if (valid.length < ids.length) {
        console.warn(
            `[default-channels] ${ids.length - valid.length} configured default channel(s) ` +
                `are missing/private/archived and were skipped for user ${userId}.`
        );
    }
    if (valid.length === 0) return;

    await db
        .insert(channelMembers)
        .values(valid.map((c) => ({ channelId: c.id, userId, role: "user" as const })))
        .onConflictDoNothing();
}

/**
 * One-time first-run setup: when the very first user (the application Owner) is
 * created, seed a public "General" channel, make the owner its channel Owner,
 * and mark it as the default auto-join channel.
 *
 * Self-gating and idempotent — it only runs when exactly one user exists and no
 * channels exist yet, so it can't recreate General after an admin deletes it,
 * and it never turns a later (pending) signup into a channel owner.
 */
export async function bootstrapFirstRun(ownerUserId: string): Promise<void> {
    await db.transaction(async (tx) => {
        // Only the application Owner ever bootstraps, and only when no channels
        // exist yet. Gating on the role (not a user count) avoids any dependency
        // on signup-transaction timing and ensures a later signup can never seed
        // General or become its owner.
        const owner = await tx.query.user.findFirst({
            where: eq(user.id, ownerUserId),
            columns: { appRole: true }
        });
        if (owner?.appRole !== "owner") return;

        const [channelRow] = await tx.select({ value: count() }).from(channels);
        if ((channelRow?.value ?? 0) > 0) return; // channels already exist — not first run

        const [general] = await tx
            .insert(channels)
            .values({
                name: "General",
                description: "Welcome! Everyone joins this channel by default.",
                icon: "hash",
                color: "#3b82f6",
                isPrivate: false,
                createdByUserId: ownerUserId
            })
            .returning({ id: channels.id });

        await tx
            .insert(channelMembers)
            .values({ channelId: general!.id, userId: ownerUserId, role: "owner" })
            .onConflictDoNothing();

        await tx
            .insert(appSettings)
            .values({ id: "app", defaultChannelIds: [general!.id] })
            .onConflictDoUpdate({
                target: appSettings.id,
                set: { defaultChannelIds: [general!.id], updatedAt: new Date() }
            });
    });
}
