import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channels } from "@workspace/db/schema";

import { ServiceError } from "./channel-members";

/** Ensure configured default channels remain visible and safe to auto-join. */
export async function validateDefaultChannelIds(channelIds: string[]): Promise<string[]> {
    const defaultChannelIds = [...new Set(channelIds)];
    if (defaultChannelIds.length === 0) return defaultChannelIds;

    const valid = await db.query.channels.findMany({
        where: and(
            inArray(channels.id, defaultChannelIds),
            eq(channels.isPrivate, false),
            eq(channels.isArchived, false)
        ),
        columns: { id: true }
    });
    if (valid.length !== defaultChannelIds.length) {
        throw new ServiceError("Default channels must be existing public channels");
    }
    return defaultChannelIds;
}
