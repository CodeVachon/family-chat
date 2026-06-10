"use client";

import { formatBytes } from "@/lib/format";
import type { AttachmentInput } from "@/lib/validation/channel";

/** Turn Cloudinary's terse upload errors into friendly, human-readable text. */
function humanizeUploadError(raw: string): string {
    if (/file size too large/i.test(raw)) {
        const max = raw.match(/Maximum is (\d+)/i);
        const limit = max ? formatBytes(Number(max[1])) : null;
        return limit
            ? `That file is too large — the maximum upload size is ${limit}.`
            : "That file is too large to upload.";
    }
    if (/unsupported|invalid.*file|not allowed|not a valid/i.test(raw)) {
        return "That file type isn't supported.";
    }
    if (/network/i.test(raw)) {
        return "Upload failed — please check your connection and try again.";
    }
    return "Sorry, that file couldn't be uploaded. Please try again.";
}

/**
 * Decide kind + Cloudinary resource type from the file itself. Non-images go to
 * `raw` so any file type uploads cleanly and isn't subject to PDF-as-image
 * delivery restrictions.
 */
function classify(file: File): { kind: AttachmentInput["kind"]; resourceType: "image" | "raw" } {
    if (file.type.startsWith("image/")) return { kind: "image", resourceType: "image" };
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    // PDFs go through the image pipeline so Cloudinary can render page previews
    // (requires "Allow delivery of PDF and ZIP files" enabled on the account).
    if (isPdf) return { kind: "pdf", resourceType: "image" };
    return { kind: "file", resourceType: "raw" };
}

function xhrUpload(
    url: string,
    form: FormData,
    onProgress?: (pct: number) => void
): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    reject(new Error("Invalid upload response"));
                }
                return;
            }
            // Translate Cloudinary's actual error (e.g. file too large).
            let message = "";
            try {
                const parsed = JSON.parse(xhr.responseText) as { error?: { message?: string } };
                message = parsed.error?.message ?? "";
            } catch {
                /* no body */
            }
            reject(new Error(humanizeUploadError(message)));
        };
        xhr.onerror = () => reject(new Error(humanizeUploadError("network")));
        xhr.send(form);
    });
}

/** Sign, then upload a file straight to Cloudinary; resolves to attachment metadata. */
export async function uploadToCloudinary(
    file: File,
    onProgress?: (pct: number) => void
): Promise<AttachmentInput> {
    const signRes = await fetch("/api/uploads/sign", { method: "POST" });
    if (!signRes.ok) {
        const err = (await signRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Uploads are not available");
    }
    const { signature, timestamp, apiKey, cloudName, folder, uniqueFilename } =
        await signRes.json();
    const { kind, resourceType } = classify(file);

    const form = new FormData();
    form.append("file", file);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("folder", folder);
    // Must match the signed param set exactly, or Cloudinary rejects the upload.
    form.append("unique_filename", String(uniqueFilename));

    const res = await xhrUpload(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        form,
        onProgress
    );

    return {
        kind,
        publicId: String(res.public_id),
        resourceType: String(res.resource_type ?? resourceType),
        secureUrl: String(res.secure_url),
        format: (res.format as string | undefined) ?? null,
        bytes: typeof res.bytes === "number" ? res.bytes : null,
        width: typeof res.width === "number" ? res.width : null,
        height: typeof res.height === "number" ? res.height : null,
        originalFilename: file.name
    };
}
