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

/** A square crop rectangle in natural-image pixels (mirrors db `AvatarCrop`). */
export type AvatarCrop = { x: number; y: number; width: number; height: number };

/**
 * Square avatar delivery URL. With a manual `crop` (from the avatar editor) it
 * crops to that exact rectangle then fits to 256²; without one it falls back to
 * the face-aware `g_auto` square. Pass the RAW Cloudinary secure URL.
 */
export function avatarUrl(secureUrl: string, crop?: AvatarCrop | null): string {
    if (crop) {
        const x = Math.max(0, Math.round(crop.x));
        const y = Math.max(0, Math.round(crop.y));
        const w = Math.max(1, Math.round(crop.width));
        const h = Math.max(1, Math.round(crop.height));
        return withTransform(
            secureUrl,
            `c_crop,x_${x},y_${y},w_${w},h_${h}/c_fill,w_256,h_256,q_auto,f_auto`
        );
    }
    return withTransform(secureUrl, "c_fill,g_auto,w_256,h_256,q_auto,f_auto");
}

/** Wide profile banner crop (social-card header). */
export function bannerUrl(secureUrl: string): string {
    return withTransform(secureUrl, "c_fill,g_auto,w_1500,h_500,q_auto,f_auto");
}
