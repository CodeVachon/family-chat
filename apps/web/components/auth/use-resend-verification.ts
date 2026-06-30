"use client";

import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

/**
 * Resend the email-verification link for `email`, with a `resending` flag and
 * success/error toasts. Shared by the login and signup forms (both surface a
 * "Resend verification email" affordance for unverified accounts).
 */
export function useResendVerification(email: string) {
    const [resending, setResending] = useState(false);

    async function resend() {
        setResending(true);
        const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/" });
        setResending(false);
        if (error) {
            toast.error(error.message ?? "Could not resend the email.");
            return;
        }
        toast.success("Verification email sent.");
    }

    return { resending, resend };
}
