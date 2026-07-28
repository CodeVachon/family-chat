/**
 * Shared constants for the installable-app (PWA) chrome: the manifest, the
 * generated raster icons, and the iOS launch images.
 *
 * `PWA_BRAND_COLOR` is deliberately a single opaque brand color rather than the
 * app's `--background` token. The manifest is fetched once at install time and
 * its `background_color` paints the OS splash before any CSS (or the user's
 * theme preference) exists, so it cannot follow light/dark. Matching the icon
 * artwork's own background makes the splash read as intentional branding in
 * both themes instead of a white flash on the way to a dark app.
 */
export const PWA_BRAND_COLOR = "#2563eb";

/** Foreground of the icon artwork (the message bubble). */
export const PWA_MARK_COLOR = "#ffffff";

/** Manifest icon sizes. 192 and 512 are the two Chrome looks for; the 512 is
 * also what it uses to generate the Android splash screen. */
export const PWA_ICON_SIZES = [192, 512] as const;

/** `apple-touch-icon` size. iOS ignores SVG here, so a raster icon is required
 * or the home-screen icon falls back to a screenshot of the page. */
export const APPLE_ICON_SIZE = 180;

/**
 * iOS launch ("startup") images. Unlike Android, iOS does not generate a splash
 * from the manifest icon — it needs an exact-size image per device, matched by
 * media query, and falls back to a flat `background_color` fill when nothing
 * matches. Portrait only: a phone is virtually always launched portrait, and an
 * unmatched orientation degrades to the brand-colored fill rather than white.
 *
 * `width`/`height` are CSS px (the media query) and `ratio` the device pixel
 * ratio; the image itself is rendered at width*ratio × height*ratio.
 */
export const APPLE_SPLASH_DEVICES = [
    { width: 440, height: 956, ratio: 3 }, // iPhone 16 Pro Max
    { width: 430, height: 932, ratio: 3 }, // iPhone 15/16 Plus, 14/15 Pro Max
    { width: 428, height: 926, ratio: 3 }, // iPhone 12/13/14 Pro Max
    { width: 402, height: 874, ratio: 3 }, // iPhone 16 Pro
    { width: 393, height: 852, ratio: 3 }, // iPhone 14/15/16 Pro
    { width: 390, height: 844, ratio: 3 }, // iPhone 12/13/14, 13/14 mini
    { width: 375, height: 812, ratio: 3 }, // iPhone X/XS/11 Pro
    { width: 414, height: 896, ratio: 3 }, // iPhone XS Max/11 Pro Max
    { width: 414, height: 896, ratio: 2 }, // iPhone XR/11
    { width: 375, height: 667, ratio: 2 }, // iPhone SE 2/3, 6/7/8
    { width: 320, height: 568, ratio: 2 } // iPhone SE (1st gen)
] as const;

export type AppleSplashDevice = (typeof APPLE_SPLASH_DEVICES)[number];

/** Pixel dimensions of the rendered launch image for a device entry. */
export function splashPixelSize(device: AppleSplashDevice): { width: number; height: number } {
    return { width: device.width * device.ratio, height: device.height * device.ratio };
}

/** `<link media="…">` value that targets exactly one device + orientation. */
export function splashMediaQuery(device: AppleSplashDevice): string {
    return [
        `(device-width: ${device.width}px)`,
        `(device-height: ${device.height}px)`,
        `(-webkit-device-pixel-ratio: ${device.ratio})`,
        `(orientation: portrait)`
    ].join(" and ");
}

/**
 * The generated-image routes are served under `/icons/…` with a `.png` suffix so
 * that `proxy.ts`'s static-asset exclusion keeps them publicly fetchable — the
 * OS requests them at install time with no session cookie.
 */
export function pwaIconPath(size: number, version: string, purpose?: "maskable"): string {
    const name = purpose === "maskable" ? `maskable-${size}` : `icon-${size}`;
    return `/icons/${name}.png?v=${version}`;
}

export function appleIconPath(version: string): string {
    return `/icons/apple-icon-${APPLE_ICON_SIZE}.png?v=${version}`;
}

export function appleSplashPath(device: AppleSplashDevice, version: string): string {
    const { width, height } = splashPixelSize(device);
    return `/icons/splash-${width}x${height}.png?v=${version}`;
}
