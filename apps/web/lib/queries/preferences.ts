import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@workspace/db/client";
import { userPreferences, type AvatarCrop } from "@workspace/db/schema";

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
    avatarSourceUrl: string | null;
    avatarCrop: AvatarCrop | null;
    bio: string | null;
    phone: string | null;
    bannerUrl: string | null;
    bannerSourceUrl: string | null;
    bannerCrop: AvatarCrop | null;
};

/**
 * Current user's preferences, with defaults applied when no row exists yet.
 * Memoized per render pass so the root layout (which sets FOUC-free font
 * attributes on <html>) and the app layout share a single query.
 */
const DEFAULT_PREFERENCES: ResolvedPreferences = {
    displayName: null,
    dateTimeFormat: "relative",
    themePreference: "system",
    notificationLevel: "mentions",
    colorHue: 220,
    fontSizeScale: "default",
    fontFamily: "figtree",
    avatarUrl: null,
    avatarSourceUrl: null,
    avatarCrop: null,
    bio: null,
    phone: null,
    bannerUrl: null,
    bannerSourceUrl: null,
    bannerCrop: null
};

export const getUserPreferences = cache(async (userId: string): Promise<ResolvedPreferences> => {
    const row = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId)
    });
    if (!row) return DEFAULT_PREFERENCES;

    // notNull columns are guaranteed present once a row exists; nullable columns
    // already carry the intended null. So no per-field fallback is needed — the
    // enum-typed columns just need a cast back to their unions.
    return {
        displayName: row.displayName,
        dateTimeFormat: row.dateTimeFormat as DateTimeFormat,
        themePreference: row.themePreference as ThemeOption,
        notificationLevel: row.notificationLevel as NotificationLevel,
        colorHue: row.colorHue,
        fontSizeScale: row.fontSizeScale as FontSizeScale,
        fontFamily: row.fontFamily as FontFamily,
        avatarUrl: row.avatarUrl,
        avatarSourceUrl: row.avatarSourceUrl,
        avatarCrop: row.avatarCrop,
        bio: row.bio,
        phone: row.phone,
        bannerUrl: row.bannerUrl,
        bannerSourceUrl: row.bannerSourceUrl,
        bannerCrop: row.bannerCrop
    };
});
