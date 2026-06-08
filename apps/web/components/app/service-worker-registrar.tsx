"use client";

import { useEffect } from "react";

/** Registers the service worker that powers background push notifications. */
export function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        const register = () => {
            navigator.serviceWorker.register("/sw.js").catch((err) => {
                console.error("[sw] registration failed", err);
            });
        };
        // Register after load so it doesn't compete with initial rendering.
        if (document.readyState === "complete") register();
        else window.addEventListener("load", register, { once: true });
    }, []);

    return null;
}
