"use client";

import { type Area } from "react-easy-crop";

import { ImageCropEditor } from "@/components/upload/image-crop-editor";

/**
 * A square avatar crop editor (round preview, since avatars render round).
 * Thin wrapper over {@link ImageCropEditor} fixing the aspect/shape/copy.
 */
export function AvatarEditor({
    open,
    imageSrc,
    initialCrop,
    onCancel,
    onComplete
}: {
    open: boolean;
    imageSrc: string | null;
    initialCrop?: Area | null;
    onCancel: () => void;
    onComplete: (croppedAreaPixels: Area) => void;
}) {
    return (
        <ImageCropEditor
            open={open}
            imageSrc={imageSrc}
            initialCrop={initialCrop}
            aspect={1}
            cropShape="round"
            title="Adjust your avatar"
            description="Drag to reposition and use the slider to zoom. Your avatar is shown as a circle."
            onCancel={onCancel}
            onComplete={onComplete}
        />
    );
}
