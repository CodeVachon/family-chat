"use client";

import { useSearchParams } from "next/navigation";

import { cn } from "@workspace/ui/lib/utils";

/**
 * Hides the channel header on narrow screens while a thread or profile panel is
 * open, matching what the panels do to the message pane — below `lg` they take
 * over the full width, and a stranded channel header above them would sit on top
 * of the panel's own.
 *
 * This lives in the layout (so the header survives navigation between the message
 * view and the gallery) but the panels are driven by the page's search params,
 * which a layout can't read — hence a client component reading them directly.
 */
export function ChannelHeaderGate({ children }: { children: React.ReactNode }) {
    const params = useSearchParams();
    const panelOpen = Boolean(params.get("thread") || params.get("profile"));

    return (
        // `shrink-0` because this wrapper — not the header inside it — is now the
        // flex item, and without it the header squishes when content overflows.
        <div
            data-component="ChannelHeaderGate"
            className={cn("shrink-0", panelOpen && "hidden lg:block")}
        >
            {children}
        </div>
    );
}
