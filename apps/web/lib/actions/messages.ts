"use server";

import { revalidatePath } from "next/cache";

import { db } from "@workspace/db/client";
import { messages } from "@workspace/db/schema";

import { authorizeChannel } from "@/lib/dal";
import { messageFormSchema } from "@/lib/validation/channel";

export async function postMessage(formData: FormData) {
    const input = messageFormSchema.parse({
        channelId: formData.get("channelId"),
        body: formData.get("body")
    });

    const { user } = await authorizeChannel(input.channelId, "channel:post");

    await db.insert(messages).values({
        channelId: input.channelId,
        authorUserId: user.id,
        body: input.body
    });

    // No realtime yet (E3) — revalidate so the sender sees their message.
    revalidatePath(`/channels/${input.channelId}`);
}
