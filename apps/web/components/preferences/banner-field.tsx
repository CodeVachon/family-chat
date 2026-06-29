"use client";

import { ImageIcon } from "lucide-react";

import { CropFieldControls } from "@/components/upload/crop-field-controls";
import { ImageCropEditor } from "@/components/upload/image-crop-editor";
import { useCropField } from "@/components/upload/use-crop-field";
import { updateBanner } from "@/lib/actions/preferences";
import { type AvatarCrop, bannerUrl as bannerTransform } from "@/lib/cloudinary/url";
import { Label } from "@workspace/ui/components/label";

/**
 * Profile banner picker + 3:1 crop editor. Mirrors the avatar flow via
 * {@link useCropField}: picking or adjusting commits immediately via
 * `updateBanner`, keeping the raw source + crop for non-destructive re-editing.
 */
export function BannerField({
    initialBannerUrl,
    initialSourceUrl,
    initialCrop
}: {
    initialBannerUrl: string | null;
    initialSourceUrl: string | null;
    initialCrop: AvatarCrop | null;
}) {
    const field = useCropField({
        initialUrl: initialBannerUrl,
        initialSourceUrl,
        initialCrop,
        transform: bannerTransform,
        persist: ({ url, sourceUrl, crop }) =>
            updateBanner({ bannerUrl: url, bannerSourceUrl: sourceUrl, bannerCrop: crop }),
        label: "Banner"
    });

    return (
        <div data-component="BannerField" className="flex flex-col gap-2">
            <Label>Profile banner</Label>
            <div className="flex items-center gap-4">
                <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {field.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={field.url} alt="" className="size-full object-cover" />
                    ) : (
                        <ImageIcon className="size-6 text-muted-foreground" />
                    )}
                </div>
                <CropFieldControls
                    hasImage={!!field.url}
                    canAdjust={!!(field.url && field.editSource)}
                    uploading={field.uploading}
                    uploadLabel="Upload banner"
                    changeLabel="Change banner"
                    onPickFile={field.openForFile}
                    onAdjust={field.openForExisting}
                    onRemove={() => void field.remove()}
                />
            </div>

            <ImageCropEditor
                open={field.editorOpen}
                imageSrc={field.editorSrc}
                initialCrop={field.pendingFile ? null : field.crop}
                aspect={3}
                title="Adjust your banner"
                description="Drag to reposition and use the slider to zoom. Your banner is shown wide (3:1)."
                onCancel={field.closeEditor}
                onComplete={(pixels) => void field.onCropComplete(pixels)}
            />
        </div>
    );
}
