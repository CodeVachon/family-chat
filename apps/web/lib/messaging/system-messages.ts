import "server-only";

import type { Database } from "@workspace/db/client";
import { messages, type SystemMessageEvent } from "@workspace/db/schema";

/** A db handle or an open transaction — both accept `.insert(...)`. */
type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Insert an inline `system` announcement (join/leave) into a channel. Authored
 * by the subject so the existing author relation resolves their name/color for
 * the clickable mention in the rendered notice. Pass the surrounding `tx` so
 * the announcement is atomic with the membership change that triggered it.
 *
 * The existing messages INSERT trigger fans this out as `message.created`, so
 * no extra realtime plumbing is needed.
 */
export async function insertSystemMessage(
    dbOrTx: DbOrTx,
    event: SystemMessageEvent & { channelId: string }
): Promise<void> {
    const { channelId, ...payload } = event;
    await dbOrTx.insert(messages).values({
        channelId,
        authorUserId: payload.subjectUserId,
        type: "system",
        systemEvent: payload,
        body: ""
    });
}
