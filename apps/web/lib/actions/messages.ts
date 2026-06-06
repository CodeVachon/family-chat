"use server";

import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { attachments, messages } from "@workspace/db/schema";

import { authorizeChannel } from "@/lib/dal";
import { ensureMessageLinkPreviews } from "@/lib/messaging/link-preview";
import { postMessageSchema } from "@/lib/validation/channel";

export async function postMessage(input: unknown) {
    const data = postMessageSchema.parse(input);
    const { user } = await authorizeChannel(data.channelId, "channel:post");

    const messageId = await db.transaction(async (tx) => {
        const [message] = await tx
            .insert(messages)
            .values({
                channelId: data.channelId,
                authorUserId: user.id,
                body: data.body.trim()
            })
            .returning({ id: messages.id });

        if (data.attachments.length > 0) {
            await tx.insert(attachments).values(
                data.attachments.map((a) => ({
                    messageId: message!.id,
                    uploaderId: user.id,
                    kind: a.kind,
                    publicId: a.publicId,
                    resourceType: a.resourceType,
                    secureUrl: a.secureUrl,
                    format: a.format,
                    bytes: a.bytes,
                    width: a.width,
                    height: a.height,
                    originalFilename: a.originalFilename
                }))
            );
        }

        return message!.id;
    });

    // Fire-and-forget: unfurl any links, then emit message.updated when ready.
    void ensureMessageLinkPreviews(messageId, data.body);

    // No realtime echo until commit; revalidate so the sender sees it instantly.
    revalidatePath(`/channels/${data.channelId}`);
}
