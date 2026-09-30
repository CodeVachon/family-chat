"use client";

import { useEffect, useRef } from "react";

import { cn } from "@workspace/ui/lib/utils";

const NEAR_BOTTOM_PX = 120;
/** How long after mount late layout growth (images, embeds, fonts) keeps us pinned. */
const SETTLE_MS = 2500;

/**
 * Scrollable message container that keeps the latest message in view.
 *
 * - On mount it pins to the bottom and stays pinned through a short settling
 *   window while content grows (images, link previews, avatars, fonts) or the
 *   viewport resizes (composer, mobile dvh). Pinning stops on the first user
 *   input, or when the window ends.
 * - When `bottomKey` changes (a new message) it scrolls to the bottom, but only
 *   if the user was already near the bottom — so reading history isn't
 *   interrupted.
 */
export function MessageScroller({
    bottomKey,
    className,
    accentColor,
    children
}: {
    bottomKey: string | number;
    className?: string;
    /** Channel color (hex) used to tint the scrollbar. */
    accentColor?: string | null;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const nearBottom = useRef(true);

    function handleScroll() {
        const el = ref.current;
        if (!el) return;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    }

    // Initial load: pin to the bottom and keep pinned while layout settles.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let settling = true;
        const pin = () => {
            if (settling) el.scrollTop = el.scrollHeight;
        };

        const resizeObserver = new ResizeObserver(pin);
        resizeObserver.observe(el);
        for (const child of Array.from(el.children)) resizeObserver.observe(child);

        // Any real user input (scroll, touch, click such as "load older", key)
        // ends the pinning so we never fight the user.
        const stop = () => {
            settling = false;
            resizeObserver.disconnect();
        };
        // `load` doesn't bubble but can be captured; covers images whose size
        // is only known once they load.
        el.addEventListener("load", pin, true);
        el.addEventListener("wheel", stop, { passive: true });
        el.addEventListener("touchstart", stop, { passive: true });
        el.addEventListener("pointerdown", stop, { passive: true });
        el.addEventListener("keydown", stop);

        pin();
        const raf = requestAnimationFrame(pin);
        const timer = setTimeout(stop, SETTLE_MS);

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(timer);
            resizeObserver.disconnect();
            el.removeEventListener("load", pin, true);
            el.removeEventListener("wheel", stop);
            el.removeEventListener("touchstart", stop);
            el.removeEventListener("pointerdown", stop);
            el.removeEventListener("keydown", stop);
        };
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (el && nearBottom.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [bottomKey]);

    return (
        <div
            data-component="MessageScroller"
            ref={ref}
            onScroll={handleScroll}
            style={
                accentColor
                    ? ({ "--scrollbar-accent": accentColor } as React.CSSProperties)
                    : undefined
            }
            className={cn(
                "min-h-0 flex-1 overflow-y-auto",
                accentColor && "channel-scrollbar",
                className
            )}
        >
            {children}
        </div>
    );
}
