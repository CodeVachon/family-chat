import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { getAppSettings } from "@/lib/queries/app-settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    // Render at request time so a renamed/re-iconed app is reflected in the manifest.
    await connection();
    const { name, iconUrl } = await getAppSettings();
    const iconSrc = iconUrl ?? "/icon.svg";
    // Only the bundled SVG has a known type; uploaded icons are left untyped.
    const iconType = iconUrl ? undefined : "image/svg+xml";
    return {
        name,
        short_name: name,
        description: `${name} — a private chat for your people`,
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2563eb",
        icons: [
            { src: iconSrc, sizes: "any", ...(iconType ? { type: iconType } : {}), purpose: "any" },
            {
                src: iconSrc,
                sizes: "any",
                ...(iconType ? { type: iconType } : {}),
                purpose: "maskable"
            }
        ]
    };
}
