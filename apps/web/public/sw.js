/* Service worker for background push notifications and the app-icon badge. */

/**
 * Put the user's current unread total on the app icon (Badging API).
 *
 * The count is fetched rather than read out of the push payload: pushes are
 * collapsed per channel and a payload can't know about reads made on another
 * device, so a payload-derived number would drift. Asking the server on each
 * push makes the badge self-healing.
 *
 * Never rejects — a badge is decoration, and this shares a `waitUntil` with the
 * notification, which must still be shown if this fails. On iOS the Badging API
 * is present but refuses without notification permission, hence the catch.
 */
async function syncAppBadge() {
    if (!("setAppBadge" in self.navigator)) return;

    try {
        // Same-origin, so the session cookie rides along and the endpoint can
        // resolve "the user" without the worker knowing who that is.
        const response = await fetch("/api/unread", { credentials: "include" });
        if (!response.ok) return;

        const { total } = await response.json();
        if (typeof total !== "number") return;

        if (total > 0) await self.navigator.setAppBadge(total);
        else await self.navigator.clearAppBadge();
    } catch {
        // Offline, signed out, or unsupported — leave the badge as it was.
    }
}

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = {};
    }

    const title = data.title || "New activity";
    const options = {
        body: data.body || "",
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: data.tag,
        // Collapse repeated notifications for the same channel.
        renotify: Boolean(data.tag),
        data: { url: data.url || "/" }
    };

    // The notification is what `userVisibleOnly` promises, so it is never gated
    // on the badge request; both run and neither can block the other.
    event.waitUntil(
        Promise.all([self.registration.showNotification(title, options), syncAppBadge()])
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            // Focus an existing tab and route it if one is open.
            for (const client of clientList) {
                if ("focus" in client) {
                    client.focus();
                    if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
                    return undefined;
                }
            }
            return self.clients.openWindow(targetUrl);
        })
    );
});
