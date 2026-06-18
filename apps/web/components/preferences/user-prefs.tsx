"use client";

import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState } from "react";

import { captureTimezone } from "@/lib/actions/preferences";
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

    // Auto-capture the device timezone once, if the user has none stored yet
    // (needed to time the nightly digest at their local midnight). The action
    // only fills a null value, so a timezone chosen in settings is never
    // clobbered.
    useEffect(() => {
        if (prefs.timezone) return;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) void captureTimezone({ timezone: tz }).catch(() => undefined);
    }, [prefs.timezone]);

    // Keep relative timestamps fresh.
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    return <PrefsContext.Provider value={{ ...prefs, nowTick }}>{children}</PrefsContext.Provider>;
}

/** A timestamp rendered in the viewer's preferred date/time format. */
export function Timestamp({ date, className }: { date: Date; className?: string }) {
    const { dateTimeFormat, nowTick } = useUserPrefs();
    return (
        <span
            data-component="Timestamp"
            suppressHydrationWarning
            className={className}
            title={date.toLocaleString()}
        >
            {formatTimestamp(date, dateTimeFormat, new Date(nowTick))}
        </span>
    );
}
