import "server-only";

import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

export const UPLOAD_FOLDER = "family-chat";

export function isCloudinaryConfigured(): boolean {
    return Boolean(cloudName && apiKey && apiSecret);
}

export type UploadSignature = {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
    uniqueFilename: boolean;
};

/**
 * Sign a direct, client-side upload for one user. The browser uploads the bytes
 * straight to Cloudinary (keeping load off our server); secrets never leave the
 * server.
 *
 * The upload is scoped to a per-user folder, and `unique_filename` is signed so
 * Cloudinary generates the public_id itself. Because the signature covers the
 * exact param set, a client cannot inject its own `public_id` (the signature
 * would no longer match and Cloudinary rejects the upload) — so it can't collide
 * with or overwrite another user's asset.
 */
export function signUpload(timestamp: number, userId: string): UploadSignature {
    if (!isCloudinaryConfigured()) {
        throw new Error("Cloudinary is not configured");
    }
    const folder = `${UPLOAD_FOLDER}/${userId}`;
    const signature = cloudinary.utils.api_sign_request(
        { folder, timestamp, unique_filename: true },
        apiSecret!
    );
    return {
        signature,
        timestamp,
        apiKey: apiKey!,
        cloudName: cloudName!,
        folder,
        uniqueFilename: true
    };
}
