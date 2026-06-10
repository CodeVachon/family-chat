import "server-only";

import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

export const UPLOAD_FOLDER = "family-chat";

/** Host that serves Cloudinary delivery URLs. */
const CLOUDINARY_DELIVERY_HOST = "res.cloudinary.com";

export function isCloudinaryConfigured(): boolean {
    return Boolean(cloudName && apiKey && apiSecret);
}

/**
 * Validate that a client-supplied attachment URL is a genuine Cloudinary
 * delivery URL for *our* cloud — not a `javascript:`/`data:` href, an arbitrary
 * host, or a Cloudinary `fetch`-type proxy of remote content. Clients send
 * attachment metadata verbatim to `postMessage`, so this is the server-side
 * gate that prevents stored XSS / content injection via `secureUrl`.
 *
 * Requires: `https:` scheme, the `res.cloudinary.com` host, our configured
 * cloud name as the first path segment, a known resource type, an `upload`
 * delivery type followed immediately by the `v<version>` segment (so no
 * attacker-supplied transformation — e.g. `l_fetch:`/`l_text:` overlays — can
 * be smuggled in), and the claimed `publicId` present in the delivery path.
 */
export function isValidAttachmentUrl(secureUrl: string, publicId: string): boolean {
    if (!cloudName || !publicId) return false;

    let url: URL;
    try {
        url = new URL(secureUrl);
    } catch {
        return false;
    }

    if (url.protocol !== "https:") return false;
    if (url.hostname !== CLOUDINARY_DELIVERY_HOST) return false;

    // Path shape: /<cloud>/<resourceType>/upload/v<version>/<...>/<publicId>.<ext>
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== cloudName) return false;
    if (!["image", "raw", "video"].includes(segments[1] ?? "")) return false;
    // Only signed uploads ("upload"); reject "fetch"/"url" which proxy remote URLs.
    if (segments[2] !== "upload") return false;
    // The version must follow "upload" directly — a delivered upload URL has no
    // transformation segment in between, so this rules out injected transforms.
    if (!/^v\d+$/.test(segments[3] ?? "")) return false;

    // The delivery path must reference the claimed asset (and thus our folder,
    // since uploads are signed into UPLOAD_FOLDER and the folder is part of the id).
    return decodeURIComponent(url.pathname).includes(`/${publicId}`);
}

export type UploadSignature = {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
};

/**
 * Sign a direct, client-side upload. The browser uploads the bytes straight to
 * Cloudinary (keeping load off our server); secrets never leave the server.
 */
export function signUpload(timestamp: number, folder: string = UPLOAD_FOLDER): UploadSignature {
    if (!isCloudinaryConfigured()) {
        throw new Error("Cloudinary is not configured");
    }
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret!);
    return { signature, timestamp, apiKey: apiKey!, cloudName: cloudName!, folder };
}
