import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth, type SessionUser } from "./auth";
import type { AppRole } from "./permissions";

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
