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
    // Author the announcement by its subject (join/leave) so the author relation
    // resolves the clickable mention; settings changes have no subject, so they
    // are authored by the actor who made the change.
    const authorUserId = "subjectUserId" in payload ? payload.subjectUserId : payload.actorUserId;
    await dbOrTx.insert(messages).values({
        channelId,
        authorUserId,
        type: "system",
        systemEvent: payload,
        body: ""
    });
}
