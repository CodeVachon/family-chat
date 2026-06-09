import "server-only";

import { inArray } from "drizzle-orm";
import webpush from "web-push";

import { db } from "@workspace/db/client";
import { pushSubscriptions, type PushSubscriptionRow } from "@workspace/db/schema";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

let configured = false;
function ensureConfigured(): boolean {
    if (configured) return true;
    if (!publicKey || !privateKey) return false;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/**
 * Send a push to all of the given users' subscriptions. Dead subscriptions
 * (404/410) are pruned. Fire-and-forget; never throws to the caller.
 */
export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (userIds.length === 0 || !ensureConfigured()) return;

    const subs = await db.query.pushSubscriptions.findMany({
        where: inArray(pushSubscriptions.userId, [...new Set(userIds)])
    });
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    const dead: string[] = [];

    await Promise.all(
        subs.map(async (sub: PushSubscriptionRow) => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    body
                );
            } catch (err) {
                const status = (err as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) dead.push(sub.endpoint);
            }
        })
    );

    if (dead.length > 0) {
        await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
    }
}
