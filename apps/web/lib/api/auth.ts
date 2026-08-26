import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { channelMembers, channels, type Channel, type ChannelMember } from "@workspace/db/schema";

import { auth, type SessionUser } from "@/lib/auth";
import { canInChannel, type AppRole, type ChannelAction } from "@/lib/permissions";

export type ApiUser = Omit<SessionUser, "appRole" | "approvalStatus"> & {
    appRole: AppRole;
    approvalStatus: "pending" | "approved" | "rejected";
};

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string
    ) {
        super(message);
    }
}

/** Authenticate a request without using Next's request-scoped helpers. */
export async function requireApiUser(requestHeaders: Headers): Promise<ApiUser> {
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session) throw new ApiError(401, "Authentication required");
    if (session.user.approvalStatus !== "approved") {
        throw new ApiError(403, "An approved account is required");
    }
    return session.user as ApiUser;
}

/** Authorize a channel operation for an actor supplied by either HTTP or Next. */
export async function authorizeApiChannel(
    actor: ApiUser,
    channelId: string,
    action: ChannelAction
): Promise<{ channel: Channel; membership: ChannelMember | null }> {
    const channel = await db.query.channels.findFirst({ where: eq(channels.id, channelId) });
    if (!channel) throw new ApiError(404, "Channel not found");

    const membership =
        (await db.query.channelMembers.findFirst({
            where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, actor.id))
        })) ?? null;

    if (!canInChannel(actor, membership, channel, action)) {
        throw new ApiError(403, "Not authorized");
    }

    return { channel, membership };
}
