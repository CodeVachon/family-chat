import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { userPreferences } from "@workspace/db/schema";

import type { DateTimeFormat, NotificationLevel, ThemeOption } from "@/lib/validation/preferences";

export type ResolvedPreferences = {
    displayName: string | null;
    dateTimeFormat: DateTimeFormat;
    themePreference: ThemeOption;
    notificationLevel: NotificationLevel;
    colorHue: number;
    avatarUrl: string | null;
};

/** Current user's preferences, with defaults applied when no row exists yet. */
export async function getUserPreferences(userId: string): Promise<ResolvedPreferences> {
    const row = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId)
    });
    return {
        displayName: row?.displayName ?? null,
        dateTimeFormat: (row?.dateTimeFormat as DateTimeFormat) ?? "relative",
        themePreference: (row?.themePreference as ThemeOption) ?? "system",
        notificationLevel: (row?.notificationLevel as NotificationLevel) ?? "mentions",
        colorHue: row?.colorHue ?? 220,
        avatarUrl: row?.avatarUrl ?? null
    };
}
