import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@workspace/db/client";
import { userPreferences } from "@workspace/db/schema";

import type {
    DateTimeFormat,
    FontFamily,
    FontSizeScale,
    NotificationLevel,
    ThemeOption
} from "@/lib/validation/preferences";

export type ResolvedPreferences = {
    displayName: string | null;
    dateTimeFormat: DateTimeFormat;
    themePreference: ThemeOption;
    notificationLevel: NotificationLevel;
    colorHue: number;
    fontSizeScale: FontSizeScale;
    fontFamily: FontFamily;
    avatarUrl: string | null;
};

/**
 * Current user's preferences, with defaults applied when no row exists yet.
 * Memoized per render pass so the root layout (which sets FOUC-free font
 * attributes on <html>) and the app layout share a single query.
 */
export const getUserPreferences = cache(async (userId: string): Promise<ResolvedPreferences> => {
    const row = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId)
    });
    return {
        displayName: row?.displayName ?? null,
        dateTimeFormat: (row?.dateTimeFormat as DateTimeFormat) ?? "relative",
        themePreference: (row?.themePreference as ThemeOption) ?? "system",
        notificationLevel: (row?.notificationLevel as NotificationLevel) ?? "mentions",
        colorHue: row?.colorHue ?? 220,
        fontSizeScale: (row?.fontSizeScale as FontSizeScale) ?? "default",
        fontFamily: (row?.fontFamily as FontFamily) ?? "figtree",
        avatarUrl: row?.avatarUrl ?? null
    };
});
