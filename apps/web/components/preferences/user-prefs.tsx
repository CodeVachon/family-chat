"use client";

import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState } from "react";

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

    // Keep relative timestamps fresh.
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    return (
        <PrefsContext.Provider value={{ ...prefs, nowTick }}>{children}</PrefsContext.Provider>
    );
}

/** A timestamp rendered in the viewer's preferred date/time format. */
export function Timestamp({ date, className }: { date: Date; className?: string }) {
    const { dateTimeFormat, nowTick } = useUserPrefs();
    return (
        <span suppressHydrationWarning className={className} title={date.toLocaleString()}>
            {formatTimestamp(date, dateTimeFormat, new Date(nowTick))}
        </span>
    );
}
