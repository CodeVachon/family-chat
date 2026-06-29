"use client";

import { ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ImageCropEditor } from "@/components/upload/image-crop-editor";
import { updateBanner } from "@/lib/actions/preferences";
import { type AvatarCrop, bannerUrl as bannerTransform, originalUrl } from "@/lib/cloudinary/url";
import { uploadToCloudinary } from "@/lib/cloudinary/upload-client";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

/**
 * Profile banner picker + 3:1 crop editor. Mirrors the avatar flow: picking or
 * adjusting commits immediately via `updateBanner` (independent of the profile
 * form's "Save changes"), keeping the raw source + crop for non-destructive
 * re-editing.
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
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [banner, setBanner] = useState(initialBannerUrl);
    const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
    const [crop, setCrop] = useState<AvatarCrop | null>(initialCrop);
    const [uploading, setUploading] = useState(false);

    const [editorOpen, setEditorOpen] = useState(false);
    const [editorSrc, setEditorSrc] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    // The image to (re-)crop: the stored raw source, else the raw recovered from
    // the baked banner URL — so banners saved before the editor still re-crop.
    const editSource = sourceUrl ?? (banner ? originalUrl(banner) : null);

    function openEditorForFile(file: File) {
        if (pendingFile && editorSrc) URL.revokeObjectURL(editorSrc);
        setPendingFile(file);
        setEditorSrc(URL.createObjectURL(file));
        setEditorOpen(true);
    }

    function openEditorForExisting() {
        if (!editSource) return;
        setPendingFile(null);
        setEditorSrc(editSource);
        setEditorOpen(true);
    }

    function closeEditor() {
        if (pendingFile && editorSrc) URL.revokeObjectURL(editorSrc);
        setEditorOpen(false);
        setEditorSrc(null);
        setPendingFile(null);
    }

    async function onCropComplete(pixels: AvatarCrop) {
        try {
            let src = editorSrc;
            if (pendingFile) {
                setUploading(true);
                const res = await uploadToCloudinary(pendingFile);
                src = res.secureUrl;
            }
            if (!src) return;
            const nextBanner = bannerTransform(src, pixels);
            await updateBanner({
                bannerUrl: nextBanner,
                bannerSourceUrl: src,
                bannerCrop: pixels
            });
            setSourceUrl(src);
            setCrop(pixels);
            setBanner(nextBanner);
            toast.success("Banner updated");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't update banner");
        } finally {
            setUploading(false);
            closeEditor();
        }
    }

    async function removeBanner() {
        try {
            await updateBanner({ bannerUrl: null, bannerSourceUrl: null, bannerCrop: null });
            setBanner(null);
            setSourceUrl(null);
            setCrop(null);
            toast.success("Banner removed");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't remove banner");
        }
    }

    return (
        <div data-component="BannerField" className="flex flex-col gap-2">
            <Label>Profile banner</Label>
            <div className="flex items-center gap-4">
                <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {banner ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={banner} alt="" className="size-full object-cover" />
                    ) : (
                        <ImageIcon className="size-6 text-muted-foreground" />
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) openEditorForFile(f);
                            e.target.value = "";
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                    >
                        {uploading ? "Uploading…" : banner ? "Change banner" : "Upload banner"}
                    </Button>
                    {banner && editSource && (
                        <Button type="button" variant="outline" onClick={openEditorForExisting}>
                            Adjust crop
                        </Button>
                    )}
                    {banner && (
                        <Button type="button" variant="ghost" onClick={() => void removeBanner()}>
                            Remove
                        </Button>
                    )}
                </div>
            </div>

            <ImageCropEditor
                open={editorOpen}
                imageSrc={editorSrc}
                initialCrop={pendingFile ? null : crop}
                aspect={3}
                title="Adjust your banner"
                description="Drag to reposition and use the slider to zoom. Your banner is shown wide (3:1)."
                onCancel={closeEditor}
                onComplete={(pixels) => void onCropComplete(pixels)}
            />
        </div>
    );
}
