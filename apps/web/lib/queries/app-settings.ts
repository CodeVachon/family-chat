import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { appSettings } from "@workspace/db/schema";
import { cache } from "react";

export type ResolvedAppSettings = { name: string; iconUrl: string | null };

/** App-wide settings with defaults applied. Memoized per request. */
export const getAppSettings = cache(async (): Promise<ResolvedAppSettings> => {
    const row = await db.query.appSettings.findFirst({ where: eq(appSettings.id, "app") });
    return { name: row?.name ?? "Family Chat", iconUrl: row?.iconUrl ?? null };
});
