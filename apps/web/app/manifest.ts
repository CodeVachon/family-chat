import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { getAppSettings } from "@/lib/queries/app-settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    // Render at request time so a renamed app is reflected in the manifest.
    await connection();
    const { name } = await getAppSettings();
    return {
        name,
        short_name: name,
        description: `${name} — a private chat for your people`,
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2563eb",
        icons: [
            {
                src: "/icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any"
            },
            {
                src: "/icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "maskable"
            }
        ]
    };
}
