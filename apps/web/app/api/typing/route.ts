import { and, eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channelMembers } from "@workspace/db/schema";

import { getSession } from "@/lib/dal";
import { getBroker } from "@/lib/realtime/broker";

export const runtime = "nodejs";

export async function POST(request: Request) {
    const session = await getSession();
    if (!session || session.user.approvalStatus !== "approved") {
        return new Response("Unauthorized", { status: 401 });
    }

    let body: { channelId?: unknown };
    try {
        body = await request.json();
    } catch {
        return new Response("Bad request", { status: 400 });
    }
    const channelId = body.channelId;
    if (typeof channelId !== "string") {
        return new Response("Bad request", { status: 400 });
    }

    // Only members broadcast typing (ephemeral, in-memory only).
    const membership = await db.query.channelMembers.findFirst({
        where: and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.userId, session.user.id)
        )
    });
    if (!membership) {
        return new Response(null, { status: 204 });
    }

    getBroker().publishEphemeral({
        type: "typing",
        channelId,
        userId: session.user.id,
        name: session.user.name,
        ts: Date.now()
    });

    return new Response(null, { status: 204 });
}
