import { and, eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channelMembers } from "@workspace/db/schema";

import { getSession } from "@/lib/dal";
import { getBroker } from "@/lib/realtime/broker";

export const runtime = "nodejs";

// Slightly under the client's 3s throttle so legitimate clients are never
// falsely limited, but a tight POST loop is rejected before it can hit the DB
// or fan out to subscribers.
const TYPING_WINDOW_MS = 2500;

// Per-user-per-channel last-seen timestamps. Pinned to globalThis so Next dev
// HMR doesn't spin up parallel maps.
const globalForTyping = globalThis as unknown as { __typingLast?: Map<string, number> };
const lastTypingAt = (globalForTyping.__typingLast ??= new Map<string, number>());

/** True if this key fired within the window; otherwise records `now` and allows. */
function typingRateLimited(key: string, now: number): boolean {
    const last = lastTypingAt.get(key);
    if (last !== undefined && now - last < TYPING_WINDOW_MS) return true;
    lastTypingAt.set(key, now);
    // Opportunistic prune so the map can't grow without bound.
    if (lastTypingAt.size > 10_000) {
        for (const [k, t] of lastTypingAt) {
            if (now - t >= TYPING_WINDOW_MS) lastTypingAt.delete(k);
        }
    }
    return false;
}

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

    // Throttle before the membership lookup so a flood costs nothing server-side.
    if (typingRateLimited(`${session.user.id}:${channelId}`, Date.now())) {
        return new Response(null, { status: 204 });
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
