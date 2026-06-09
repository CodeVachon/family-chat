"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@workspace/db/client";
import { pushSubscriptions } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";

const subscriptionSchema = z.object({
    endpoint: z.string().url(),
    p256dh: z.string().min(1),
    auth: z.string().min(1)
});

/** Store (or refresh) a Web Push subscription for the current user. */
export async function savePushSubscription(input: unknown) {
    const data = subscriptionSchema.parse(input);
    const user = await requireApprovedUser();

    await db
        .insert(pushSubscriptions)
        .values({ userId: user.id, endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth })
        .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: { userId: user.id, p256dh: data.p256dh, auth: data.auth }
        });
}

/**
 * The VAPID public key the browser needs to subscribe. Read at request time so
 * it's supplied by the runtime environment (no NEXT_PUBLIC_ build-time inlining),
 * keeping the built image free of instance-specific config. It is a *public*
 * key by design, so no auth gate is required.
 */
export async function getVapidPublicKey(): Promise<string | null> {
    return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function removePushSubscription(endpoint: string) {
    const user = await requireApprovedUser();
    await db
        .delete(pushSubscriptions)
        .where(
            and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id))
        );
}
