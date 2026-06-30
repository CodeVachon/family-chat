"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export type ApprovalStatus = "approved" | "pending" | "rejected" | "signed-out";

/**
 * Set an initial password for a user who has none (e.g. created via magic
 * link). Better-Auth's `changePassword` requires the current password, which
 * these users never had; `setPassword` links a fresh credential account and
 * errors if one already exists, so it's safe to call only in the no-password
 * case. Returns an error message on failure, or null on success.
 */
export async function setInitialPassword(newPassword: string): Promise<string | null> {
    if (newPassword.length < 8) {
        return "New password must be at least 8 characters";
    }
    try {
        await auth.api.setPassword({
            body: { newPassword },
            headers: await headers()
        });
        return null;
    } catch (err) {
        if (err instanceof APIError) {
            return err.body?.message ?? "Couldn't set password";
        }
        console.error("[account] setInitialPassword failed", err);
        return "Couldn't set password";
    }
}

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
