/**
 * Format a message timestamp. E6 will make this honor each user's preferred
 * date/time format; for now it shows time-of-day for today and a short date
 * otherwise. Computed on the server and rendered as static text.
 */
export function formatMessageTime(date: Date, now: Date = new Date()): string {
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (sameDay) {
        return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}
