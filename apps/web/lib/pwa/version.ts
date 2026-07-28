import "server-only";

import { createHash } from "node:crypto";

/**
 * Cache-busting token for the generated PWA images (icons + iOS launch images).
 * Stable while the app icon is unchanged so the OS can cache them immutably, and
 * different as soon as an admin uploads a new icon.
 */
export function pwaAssetVersion(iconUrl: string | null): string {
    return createHash("sha1")
        .update(iconUrl ?? "default")
        .digest("hex")
        .slice(0, 8);
}
