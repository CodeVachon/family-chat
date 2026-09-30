"use client";

import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { formatTimestamp } from "@/lib/format";
import type { ResolvedPreferences } from "@/lib/queries/preferences";

type PrefsContextValue = ResolvedPreferences & { nowTick: number };

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function useUserPrefs(): PrefsContextValue {
    const ctx = useContext(PrefsContext);
    if (!ctx) throw new Error("useUserPrefs must be used within a UserPrefsProvider");
    return ctx;
}

export function UserPrefsProvider({
    prefs,
    children
}: {
    prefs: ResolvedPreferences;
    children: React.ReactNode;
}) {
    const { setTheme } = useTheme();
    const [nowTick, setNowTick] = useState(() => Date.now());

    // Apply the saved theme (cross-device default).
    useEffect(() => {
        setTheme(prefs.themePreference);
    }, [prefs.themePreference, setTheme]);

    // Keep the font-size/family attributes on <html> in sync after a refresh
    // (e.g. saved on another device). The root layout sets them server-side for
    // the initial paint; this covers later changes without a full reload.
    useEffect(() => {
        const el = document.documentElement;
        el.dataset.fontSize = prefs.fontSizeScale;
        el.dataset.fontFamily = prefs.fontFamily;
    }, [prefs.fontSizeScale, prefs.fontFamily]);

    // Keep relative timestamps fresh.
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    return <PrefsContext.Provider value={{ ...prefs, nowTick }}>{children}</PrefsContext.Provider>;
}

const subscribeNoop = () => () => {};

/** False during SSR and the hydration pass, true on every client render after. */
function useIsClient(): boolean {
    return useSyncExternalStore(
        subscribeNoop,
        () => true,
        () => false
    );
}

/**
 * A timestamp rendered in the viewer's preferred date/time format, in the
 * viewer's own timezone.
 *
 * The instant is only formatted on the client. Formatting during SSR uses the
 * *server's* timezone (UTC in production), and React does not patch a
 * hydration text mismatch on a `suppressHydrationWarning` element, so the
 * server's wall-clock time (e.g. `00:32` instead of `20:32`) would stick until
 * the next text change. Rendering an empty placeholder for the server/hydration
 * pass lets React swap in the locally formatted time right after hydrating.
 */
export function Timestamp({ date, className }: { date: Date; className?: string }) {
    const { dateTimeFormat, nowTick } = useUserPrefs();
    const isClient = useIsClient();
    return (
        <span
            data-component="Timestamp"
            className={className}
            title={isClient ? date.toLocaleString() : undefined}
        >
            {isClient ? formatTimestamp(date, dateTimeFormat, new Date(nowTick)) : null}
        </span>
    );
}
