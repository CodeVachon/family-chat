"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { uploadToCloudinary } from "@/lib/cloudinary/upload-client";
import { Button } from "@workspace/ui/components/button";

/**
 * Reusable image picker: renders a caller-provided preview plus Upload/Remove
 * controls, uploads to Cloudinary, and reports the (optionally transformed) URL.
 */
export function ImageUploadField({
    value,
    onChange,
    transform,
    renderPreview,
    uploadLabel = "Upload",
    onUploadingChange
}: {
    value: string | null;
    onChange: (url: string | null) => void;
    transform: (secureUrl: string) => string;
    renderPreview: (url: string | null) => React.ReactNode;
    uploadLabel?: string;
    onUploadingChange?: (uploading: boolean) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    async function handleFile(file: File) {
        setUploading(true);
        onUploadingChange?.(true);
        try {
            const res = await uploadToCloudinary(file);
            onChange(transform(res.secureUrl));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
            onUploadingChange?.(false);
        }
    }

    return (
        <div data-component="ImageUploadField" className="flex items-center gap-4">
            {renderPreview(value)}
            <div className="flex gap-2">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFile(f);
                        e.target.value = "";
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                >
                    {uploading ? "Uploading…" : uploadLabel}
                </Button>
                {value && (
                    <Button type="button" variant="ghost" onClick={() => onChange(null)}>
                        Remove
                    </Button>
                )}
            </div>
        </div>
    );
}
