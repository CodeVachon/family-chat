"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { refreshApprovalStatus } from "@/lib/actions/account";

/**
 * Polls the user's approval status while they wait on the pending screen and
 * advances them automatically once an admin acts — no manual refresh or
 * re-login. The poll bypasses the session cookie cache (see
 * refreshApprovalStatus), so the redirect into the app sees the fresh status.
 */
export function PendingWatcher({ intervalMs = 5000 }: { intervalMs?: number }) {
    const router = useRouter();

    useEffect(() => {
        let active = true;

        async function check() {
            try {
                const status = await refreshApprovalStatus();
                if (!active) return;
                if (status === "approved") {
                    router.replace("/");
                } else if (status === "signed-out") {
                    router.replace("/login");
                } else if (status === "rejected") {
                    // Update the screen to the rejected message.
                    router.refresh();
                }
            } catch {
                // Transient error (offline, etc.) — keep polling.
            }
        }

        // Check once right away (an admin may approve in the first interval),
        // then poll.
        void check();
        const id = setInterval(check, intervalMs);
        return () => {
            active = false;
            clearInterval(id);
        };
    }, [router, intervalMs]);

    return null;
}
