import { mock } from "bun:test";

/** Fake `@/lib/cloudinary/server` — avoids needing real Cloudinary credentials. */
export const isCloudinaryConfigured = mock(() => true);
export const isValidAttachmentUrl = mock(() => true);
export const signUpload = mock(() => ({
    signature: "sig",
    timestamp: 1,
    apiKey: "test-api-key",
    cloudName: "test-cloud",
    folder: "family-chat/test-user",
    uniqueFilename: true
}));

export function resetCloudinary() {
    isCloudinaryConfigured.mockReset().mockImplementation(() => true);
    isValidAttachmentUrl.mockReset().mockImplementation(() => true);
    signUpload.mockReset().mockImplementation(() => ({
        signature: "sig",
        timestamp: 1,
        apiKey: "test-api-key",
        cloudName: "test-cloud",
        folder: "family-chat/test-user",
        uniqueFilename: true
    }));
}
