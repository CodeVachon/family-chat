"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export type ApprovalStatus = "approved" | "pending" | "rejected" | "signed-out";

/**
 * Read the current user's approval status from the DB, bypassing Better-Auth's
 * session cookie cache. `disableCookieCache` forces a fresh read AND rewrites
 * the cached cookie, so once an admin approves the user, the very next request
 * (e.g. the redirect into the app) sees `approved` without a re-login.
 *
 * Used by the pending screen's poller to auto-advance an approved user.
 */
export async function refreshApprovalStatus(): Promise<ApprovalStatus> {
    const session = await auth.api.getSession({
        headers: await headers(),
        query: { disableCookieCache: true }
    });
    if (!session) return "signed-out";
    return (session.user.approvalStatus as Exclude<ApprovalStatus, "signed-out">) ?? "pending";
}
