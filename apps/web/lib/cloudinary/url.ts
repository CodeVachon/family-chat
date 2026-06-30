/**
 * Pure Cloudinary delivery-URL helpers. They rewrite the transformation segment
 * of an already-returned secure URL, so they need no secrets or cloud name and
 * are safe to import on the client.
 */

function withTransform(secureUrl: string, transform: string): string {
    return secureUrl.includes("/upload/")
        ? secureUrl.replace("/upload/", `/upload/${transform}/`)
        : secureUrl;
}

/**
 * Recover the raw delivery URL from a Cloudinary URL that has a baked-in
 * transform, by stripping every transform segment between `/upload/` and the
 * `v<version>` segment. Delivery URLs look like
 * `…/upload/<transform…>/v<version>/<folder>/<publicId>.<ext>`; the transform
 * can itself be several `/`-separated segments (e.g. `c_crop,…/c_fill,…`).
 * Returns the URL unchanged if it isn't a recognizable `/upload/` URL, is
 * already raw (a version directly follows `/upload/`), or has no version
 * segment to anchor on.
 */
export function originalUrl(secureUrl: string): string {
    const marker = "/upload/";
    const idx = secureUrl.indexOf(marker);
    if (idx === -1) return secureUrl;

    const prefix = secureUrl.slice(0, idx + marker.length);
    const segments = secureUrl.slice(idx + marker.length).split("/");
    const versionIdx = segments.findIndex((s) => /^v\d+$/.test(s));
    // No version to anchor on, or already raw — nothing safe to strip.
    if (versionIdx <= 0) return secureUrl;
    return prefix + segments.slice(versionIdx).join("/");
}

/** Gallery thumbnail (auto format/quality, bounded size). */
export function thumbUrl(secureUrl: string): string {
    return withTransform(secureUrl, "c_limit,w_900,q_auto,f_auto");
}

/** Full-size image for the lightbox. */
export function fullUrl(secureUrl: string): string {
    return withTransform(secureUrl, "c_limit,w_1920,q_auto,f_auto");
}

/** Page-1 image preview of a PDF uploaded via the image pipeline. */
export function pdfThumbUrl(secureUrl: string): string {
    return withTransform(secureUrl, "pg_1,w_600,q_auto,f_jpg");
}

/** Nth-page image of a PDF (1-based). Rendered as JPG via the image pipeline. */
export function pdfPageUrl(secureUrl: string, page: number): string {
    return withTransform(secureUrl, `pg_${page},w_1000,q_auto,f_jpg`);
}

/** A crop rectangle in natural-image pixels (mirrors db `AvatarCrop`). */
export type AvatarCrop = { x: number; y: number; width: number; height: number };

/**
 * Crop to a manual rectangle (rounded/clamped to safe integers) then fit to
 * `w`×`h` — the shared body of the avatar/banner delivery URLs.
 */
function croppedFill(secureUrl: string, crop: AvatarCrop, w: number, h: number): string {
    const x = Math.max(0, Math.round(crop.x));
    const y = Math.max(0, Math.round(crop.y));
    const cw = Math.max(1, Math.round(crop.width));
    const ch = Math.max(1, Math.round(crop.height));
    return withTransform(
        secureUrl,
        `c_crop,x_${x},y_${y},w_${cw},h_${ch}/c_fill,w_${w},h_${h},q_auto,f_auto`
    );
}

/**
 * Square avatar delivery URL. With a manual `crop` (from the avatar editor) it
 * crops to that exact rectangle then fits to 256²; without one it falls back to
 * the face-aware `g_auto` square. Pass the RAW Cloudinary secure URL.
 */
export function avatarUrl(secureUrl: string, crop?: AvatarCrop | null): string {
    return crop
        ? croppedFill(secureUrl, crop, 256, 256)
        : withTransform(secureUrl, "c_fill,g_auto,w_256,h_256,q_auto,f_auto");
}

/**
 * Wide (3:1) profile banner delivery URL. With a manual `crop` (from the banner
 * editor) it crops to that exact rectangle then fits to 1500×500; without one it
 * falls back to the content-aware `g_auto` fill. Pass the RAW Cloudinary URL.
 */
export function bannerUrl(secureUrl: string, crop?: AvatarCrop | null): string {
    return crop
        ? croppedFill(secureUrl, crop, 1500, 500)
        : withTransform(secureUrl, "c_fill,g_auto,w_1500,h_500,q_auto,f_auto");
}
