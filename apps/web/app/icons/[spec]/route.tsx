import { ImageResponse } from "next/og";

import { isTransformable, squarePngUrl } from "@/lib/cloudinary/url";
import {
    APPLE_ICON_SIZE,
    APPLE_SPLASH_DEVICES,
    PWA_BRAND_COLOR,
    PWA_ICON_SIZES,
    PWA_MARK_COLOR,
    splashPixelSize
} from "@/lib/pwa/brand";
import { getAppSettings } from "@/lib/queries/app-settings";

/**
 * Raster PWA artwork, generated on demand.
 *
 * Android builds its splash screen from the manifest's 512px icon and iOS needs
 * a raster `apple-touch-icon` plus exact-size launch images — none of which can
 * be satisfied by the SVG app icon. Rather than checking in a matrix of PNGs
 * (which would only cover the bundled default and not an admin-uploaded icon),
 * every size is rendered here from a single source: the uploaded icon when there
 * is one, otherwise the bundled mark redrawn below.
 *
 * The `.png` suffix is load-bearing: `proxy.ts` excludes static image
 * extensions from auth routing, and the OS fetches these with no session cookie
 * when installing the app.
 */

/** Bundled artwork — kept in sync with `public/icon.svg`, whose 512px viewBox
 * these proportions are taken from. Redrawn as elements because Satori renders
 * JSX, not SVG files. */
function BubbleMark({ size }: { size: number }) {
    // Scale a length from the 512px reference artwork into the requested box.
    const s = (n: number) => (n * size) / 512;
    const dot = { width: s(32), height: s(32), borderRadius: s(32), background: PWA_BRAND_COLOR };

    return (
        <div style={{ display: "flex", position: "relative" }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: s(16),
                    width: s(272),
                    height: s(164),
                    borderRadius: s(36),
                    background: PWA_MARK_COLOR
                }}
            >
                <div style={dot} />
                <div style={dot} />
                <div style={dot} />
            </div>
            {/* The bubble's tail: a rotated square poking out of the bottom-left.
                Same fill as the bubble, so the overlap is seamless. */}
            <div
                style={{
                    position: "absolute",
                    left: s(48),
                    top: s(140),
                    width: s(56),
                    height: s(56),
                    borderRadius: s(8),
                    background: PWA_MARK_COLOR,
                    transform: "rotate(45deg)"
                }}
            />
        </div>
    );
}

/** The app's icon at `markSize`, centered on the brand background. */
function Artwork({
    width,
    height,
    markSize,
    cornerRadius,
    iconUrl
}: {
    width: number;
    height: number;
    markSize: number;
    cornerRadius: number;
    iconUrl: string | null;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width,
                height,
                borderRadius: cornerRadius,
                background: PWA_BRAND_COLOR
            }}
        >
            {/* Satori can only rasterize a bitmap, so an uploaded icon is used
                only when Cloudinary can hand us a PNG of it; anything else (an
                icon hosted elsewhere, an SVG) falls back to the bundled mark
                rather than failing the whole image. */}
            {iconUrl && isTransformable(iconUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={squarePngUrl(iconUrl, markSize)}
                    alt=""
                    width={markSize}
                    height={markSize}
                    style={{ borderRadius: cornerRadius }}
                />
            ) : (
                <BubbleMark size={markSize} />
            )}
        </div>
    );
}

type ArtworkSpec = {
    width: number;
    height: number;
    markSize: number;
    cornerRadius: number;
};

/**
 * Resolve a requested filename to its artwork geometry, or null when it isn't
 * one we generate. Only sizes named by the manifest and the launch-image link
 * tags are accepted, so the route can't be driven to render arbitrary
 * dimensions.
 */
function artworkFor(spec: string): ArtworkSpec | null {
    const name = spec.endsWith(".png") ? spec.slice(0, -".png".length) : null;
    if (!name) return null;

    // Standard icon: the mark fills the tile, with the artwork's own rounded
    // corners (radius/side = 104/512 in the reference SVG).
    const icon = /^icon-(\d+)$/.exec(name);
    if (icon) {
        const size = Number(icon[1]);
        if (!(PWA_ICON_SIZES as readonly number[]).includes(size)) return null;
        return { width: size, height: size, markSize: size, cornerRadius: (size * 104) / 512 };
    }

    // Maskable icon: square-cornered and full-bleed, with the mark inside the
    // 80% safe zone so an aggressive OS mask (circle, squircle) can't clip it.
    const maskable = /^maskable-(\d+)$/.exec(name);
    if (maskable) {
        const size = Number(maskable[1]);
        if (!(PWA_ICON_SIZES as readonly number[]).includes(size)) return null;
        return { width: size, height: size, markSize: Math.round(size * 0.8), cornerRadius: 0 };
    }

    if (name === `apple-icon-${APPLE_ICON_SIZE}`) {
        const size = APPLE_ICON_SIZE;
        // iOS applies its own mask, so the source is square-cornered.
        return { width: size, height: size, markSize: size, cornerRadius: 0 };
    }

    const splash = /^splash-(\d+)x(\d+)$/.exec(name);
    if (splash) {
        const width = Number(splash[1]);
        const height = Number(splash[2]);
        const known = APPLE_SPLASH_DEVICES.some((device) => {
            const px = splashPixelSize(device);
            return px.width === width && px.height === height;
        });
        if (!known) return null;
        // A comfortable, non-dominant mark, sized off the narrow edge so it
        // lands the same relative size on every device.
        return { width, height, markSize: Math.round(width * 0.55), cornerRadius: 0 };
    }

    return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ spec: string }> }) {
    const { spec } = await params;
    const artwork = artworkFor(spec);
    if (!artwork) return new Response("Not found", { status: 404 });

    const { iconUrl } = await getAppSettings();

    return new ImageResponse(
        <Artwork
            width={artwork.width}
            height={artwork.height}
            markSize={artwork.markSize}
            cornerRadius={artwork.cornerRadius}
            iconUrl={iconUrl}
        />,
        {
            width: artwork.width,
            height: artwork.height,
            headers: {
                // Callers address these with a ?v= token derived from the icon,
                // so a given URL's bytes never change.
                "cache-control": "public, max-age=31536000, immutable"
            }
        }
    );
}
