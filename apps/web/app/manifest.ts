import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { PWA_BRAND_COLOR, PWA_ICON_SIZES, pwaIconPath } from "@/lib/pwa/brand";
import { pwaAssetVersion } from "@/lib/pwa/version";
import { getAppSettings } from "@/lib/queries/app-settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    // Render at request time so a renamed/re-iconed app is reflected in the manifest.
    await connection();
    const { name, iconUrl } = await getAppSettings();
    const version = pwaAssetVersion(iconUrl);

    // Chrome builds the Android splash screen from `name`, `background_color` and
    // a raster icon of at least 512px — an SVG at `sizes: "any"` doesn't qualify,
    // which is why the splash used to be a bare fill with no branding. These are
    // rendered by app/icons/[spec], from the uploaded icon when there is one.
    const icons = PWA_ICON_SIZES.flatMap((size) => [
        {
            src: pwaIconPath(size, version),
            sizes: `${size}x${size}`,
            type: "image/png",
            purpose: "any" as const
        },
        {
            src: pwaIconPath(size, version, "maskable"),
            sizes: `${size}x${size}`,
            type: "image/png",
            purpose: "maskable" as const
        }
    ]);

    return {
        name,
        short_name: name,
        description: `${name} — a private chat for your people`,
        start_url: "/",
        display: "standalone",
        background_color: PWA_BRAND_COLOR,
        theme_color: PWA_BRAND_COLOR,
        icons
    };
}
