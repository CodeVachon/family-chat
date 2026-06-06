/**
 * Format a message timestamp. E6 will make this honor each user's preferred
 * date/time format; for now it shows time-of-day for today and a short date
 * otherwise. Computed on the server and rendered as static text.
 */
export function formatBytes(bytes: number | null | undefined): string {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

import type { DateTimeFormat } from "@/lib/validation/preferences";

function sameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function formatRelative(date: Date, now: Date): string {
    const diffMs = date.getTime() - now.getTime();
    const absSec = Math.abs(diffMs) / 1000;
    if (absSec < 45) return "just now";

    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    const minutes = diffMs / 60000;
    if (Math.abs(minutes) < 60) return rtf.format(Math.round(minutes), "minute");
    const hours = minutes / 60;
    if (Math.abs(hours) < 24) return rtf.format(Math.round(hours), "hour");
    const days = hours / 24;
    if (Math.abs(days) < 7) return rtf.format(Math.round(days), "day");
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Format a timestamp per the user's preferred style. */
export function formatTimestamp(
    date: Date,
    format: DateTimeFormat,
    now: Date = new Date()
): string {
    if (format === "relative") return formatRelative(date, now);

    const time = date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: format === "12h"
    });
    if (sameDay(date, now)) return time;
    const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${day}, ${time}`;
}
