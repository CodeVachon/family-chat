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

/** Square, face-aware avatar crop. */
export function avatarUrl(secureUrl: string): string {
    return withTransform(secureUrl, "c_fill,g_auto,w_256,h_256,q_auto,f_auto");
}

/** Wide profile banner crop (social-card header). */
export function bannerUrl(secureUrl: string): string {
    return withTransform(secureUrl, "c_fill,g_auto,w_1500,h_500,q_auto,f_auto");
}
