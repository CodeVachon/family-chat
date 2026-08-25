import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channelMembers } from "@workspace/db/schema";

/** Filter arbitrary user ids to members of the given channel. */
export async function memberIdsIn(channelId: string, userIds: string[]): Promise<string[]> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return [];
    const rows = await db
        .select({ userId: channelMembers.userId })
        .from(channelMembers)
        .where(
            and(eq(channelMembers.channelId, channelId), inArray(channelMembers.userId, unique))
        );
    return rows.map((row) => row.userId);
}
