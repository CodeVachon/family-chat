"use client";

import {
    getVapidPublicKey,
    removePushSubscription,
    savePushSubscription
} from "@/lib/actions/push";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(normalized);
    const buffer = new ArrayBuffer(raw.length);
    const output = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
}

export function pushSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        typeof Notification !== "undefined"
    );
}

/** Request permission, subscribe to Web Push, and persist the subscription. */
export async function subscribeToPush(): Promise<"granted" | "denied" | "unsupported" | "error"> {
    if (!pushSupported()) return "unsupported";

    // Fetched at runtime from the server (see getVapidPublicKey) rather than
    // inlined at build time, so the same image works for any deployment.
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) return "unsupported";

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub =
            existing ??
            (await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            }));

        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "error";

        await savePushSubscription({
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth
        });
        return "granted";
    } catch {
        return "error";
    }
}

/** Unsubscribe this device from Web Push and forget the subscription. */
export async function unsubscribeFromPush(): Promise<void> {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await removePushSubscription(endpoint);
}
