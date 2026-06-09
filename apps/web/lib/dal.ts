import "server-only";

import { and, eq } from "drizzle-orm";
import { forbidden, notFound } from "next/navigation";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@workspace/db/client";
import { channelMembers, channels, type Channel, type ChannelMember } from "@workspace/db/schema";

import { auth, type SessionUser } from "./auth";
import { canInChannel, type AppRole, type ChannelAction } from "./permissions";

/**
 * Session user with our custom fields narrowed to their enum unions. Better-Auth
 * infers additionalFields as plain `string | null | undefined`; the DB defaults
 * guarantee valid values, so we narrow at the DAL boundary.
 */
export type AppUser = Omit<SessionUser, "appRole" | "approvalStatus"> & {
    appRole: AppRole;
    approvalStatus: "pending" | "approved" | "rejected";
};

/**
 * Authoritative (DB-backed) session read, memoized per render pass.
 * This is the secure layer — proxy.ts only does optimistic cookie checks.
 */
export const getSession = cache(async () => {
    return auth.api.getSession({ headers: await headers() });
});

/** Require an authenticated user, else redirect to login. */
export const requireUser = cache(async (): Promise<AppUser> => {
    const session = await getSession();
    if (!session) {
        redirect("/login");
    }
    return session.user as AppUser;
});

/**
 * The approval gate in code: require an authenticated AND approved user.
 * Pending/rejected users are sent to the waiting screen.
 */
export const requireApprovedUser = cache(async (): Promise<AppUser> => {
    const user = await requireUser();
    if (user.approvalStatus !== "approved") {
        redirect("/pending");
    }
    return user;
});

/** The current user's membership row for a channel (or null), memoized. */
export const getChannelMembership = cache(
    async (channelId: string, userId: string): Promise<ChannelMember | null> => {
        const membership = await db.query.channelMembers.findFirst({
            where: and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId))
        });
        return membership ?? null;
    }
);

/**
 * Authoritatively authorize the current user for a channel action. Loads the
 * channel + membership, runs the permission check, and interrupts the request
 * (notFound / forbidden) on failure. Returns the loaded channel + membership.
 */
export async function authorizeChannel(
    channelId: string,
    action: ChannelAction
): Promise<{ user: AppUser; channel: Channel; membership: ChannelMember | null }> {
    const user = await requireApprovedUser();

    const channel = await db.query.channels.findFirst({
        where: eq(channels.id, channelId)
    });
    if (!channel) {
        notFound();
    }

    const membership = await getChannelMembership(channelId, user.id);

    if (!canInChannel(user, membership, channel, action)) {
        forbidden();
    }

    return { user, channel, membership };
}
