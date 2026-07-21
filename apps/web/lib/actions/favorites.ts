"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { channelMembers } from "@workspace/db/schema";

import { requireApprovedUser } from "@/lib/dal";

/**
 * Toggle the current user's "favorite" flag on a channel. Favorited channels
 * pin to the top of the sidebar. The flip is scoped to the user's own
 * membership row, so it no-ops for non-members (there's no row to update) —
 * only members can favorite a channel. Revalidates the app layout so the
 * sidebar re-fetches and reorders.
 */
export async function toggleChannelFavorite(channelId: string) {
    const user = await requireApprovedUser();

    await db
        .update(channelMembers)
        .set({ isFavorite: sql`NOT ${channelMembers.isFavorite}`, updatedAt: new Date() })
        .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));

    revalidatePath("/", "layout");
}
