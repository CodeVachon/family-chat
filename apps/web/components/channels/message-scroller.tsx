"use client";

import { useEffect, useRef } from "react";

import { cn } from "@workspace/ui/lib/utils";

const NEAR_BOTTOM_PX = 120;

/**
 * Scrollable message container that keeps the latest message in view: scrolls
 * to the bottom on load, and again when `bottomKey` changes (a new message)
 * but only if the user was already near the bottom — so reading history isn't
 * interrupted.
 */
export function MessageScroller({
    bottomKey,
    className,
    children
}: {
    bottomKey: string | number;
    className?: string;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const nearBottom = useRef(true);

    function handleScroll() {
        const el = ref.current;
        if (!el) return;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    }

    useEffect(() => {
        const el = ref.current;
        if (el && nearBottom.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [bottomKey]);

    return (
        <div
            ref={ref}
            onScroll={handleScroll}
            className={cn("min-h-0 flex-1 overflow-y-auto", className)}
        >
            {children}
        </div>
    );
}
