"use client";

import { useRef } from "react";

import { Button } from "@workspace/ui/components/button";

/**
 * Upload / Adjust crop / Remove controls shared by the avatar and banner crop
 * fields. Owns the hidden file input; the parent supplies the crop-field
 * handlers (typically from {@link useCropField}).
 */
export function CropFieldControls({
    hasImage,
    canAdjust,
    uploading,
    uploadLabel,
    changeLabel,
    onPickFile,
    onAdjust,
    onRemove
}: {
    hasImage: boolean;
    canAdjust: boolean;
    uploading: boolean;
    uploadLabel: string;
    changeLabel: string;
    onPickFile: (file: File) => void;
    onAdjust: () => void;
    onRemove: () => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);

    return (
        <div data-component="CropFieldControls" className="flex flex-wrap gap-2">
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                    e.target.value = "";
                }}
            />
            <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
            >
                {uploading ? "Uploading…" : hasImage ? changeLabel : uploadLabel}
            </Button>
            {canAdjust && (
                <Button type="button" variant="outline" onClick={onAdjust}>
                    Adjust crop
                </Button>
            )}
            {hasImage && (
                <Button type="button" variant="ghost" onClick={onRemove}>
                    Remove
                </Button>
            )}
        </div>
    );
}
