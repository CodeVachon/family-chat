"use client";

import { useEffect } from "react";

/**
 * Mirrors the unread count onto the installed app's icon badge via the Badging
 * API — the home-screen badge on Android and iOS 16.4+, the dock/taskbar badge on
 * desktop. Renders nothing.
 *
 * This is the foreground half of the badge: it keeps the count honest while the
 * app is open (including clearing it the moment a channel is read). The service
 * worker's `push` handler covers the app-closed case.
 *
 * A no-op wherever the API is missing. The calls reject rather than throw on
 * platforms that expose but refuse them (e.g. iOS without notification
 * permission), so both are caught.
 */
export function AppBadge({ count }: { count: number }) {
    useEffect(() => {
        if (!("setAppBadge" in navigator)) return;
        if (count > 0) {
            navigator.setAppBadge(count).catch(() => {});
        } else {
            navigator.clearAppBadge().catch(() => {});
        }
    }, [count]);

    return null;
}
