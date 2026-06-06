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
