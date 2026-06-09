"use client";

import { useRealtime } from "@/components/realtime/realtime-provider";

export function ConnectionBanner() {
    const { connected } = useRealtime();
    if (connected) return null;
    return (
        <div
            data-component="ConnectionBanner"
            className="shrink-0 bg-amber-500/90 px-3 py-1 text-center text-xs font-medium text-amber-950"
        >
            Reconnecting…
        </div>
    );
}
