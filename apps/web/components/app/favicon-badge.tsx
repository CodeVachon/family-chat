"use client";

import { useEffect, useRef } from "react";

function iconLink(): HTMLLinkElement {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    return link;
}

function drawBadged(base: HTMLImageElement | null, count: number): string {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    if (base) {
        ctx.drawImage(base, 0, 0, size, size);
    } else {
        ctx.fillStyle = "#2563eb";
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Red notification badge (top-right).
    const r = size * 0.3;
    const cx = size - r;
    const cy = r;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(r * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count > 9 ? "9+" : String(count), cx, cy + 1);

    return canvas.toDataURL("image/png");
}

/**
 * Reflects unread count in the tab: prefixes the document title with "(N)" and
 * overlays a red badge on the favicon. Renders nothing.
 */
export function FaviconBadge({ count }: { count: number }) {
    const originalHref = useRef<string | null>(null);

    useEffect(() => {
        const base = document.title.replace(/^\(\d+\)\s*/, "");
        document.title = count > 0 ? `(${count}) ${base}` : base;
    }, [count]);

    useEffect(() => {
        const link = iconLink();
        if (originalHref.current === null) {
            originalHref.current = link.getAttribute("href") || "/favicon.ico";
        }
        const original = originalHref.current;

        if (count === 0) {
            link.href = original;
            return;
        }

        const img = new Image();
        img.onload = () => {
            link.href = drawBadged(img, count);
        };
        img.onerror = () => {
            link.href = drawBadged(null, count);
        };
        img.src = original;
    }, [count]);

    return null;
}
