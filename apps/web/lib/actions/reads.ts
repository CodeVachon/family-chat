"use server";

import { requireApprovedUser } from "@/lib/dal";
import { recordChannelRead } from "@/lib/services/channel-members";

/**
 * Mark a channel as read up to its latest message for the current user.
 * No-ops for non-members (no membership row to update). The read-pointer
 * trigger emits a `read.updated` event so the user's other tabs resync.
 */
export async function markChannelRead(channelId: string) {
    const user = await requireApprovedUser();

    await recordChannelRead(channelId, user.id);
}
