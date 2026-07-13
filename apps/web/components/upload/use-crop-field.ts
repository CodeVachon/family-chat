"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { type ActionResult } from "@/lib/actions/result";
import { type AvatarCrop, originalUrl } from "@/lib/cloudinary/url";
import { uploadToCloudinary } from "@/lib/cloudinary/upload-client";

type CropPayload = { url: string | null; sourceUrl: string | null; crop: AvatarCrop | null };

/**
 * Shared state + handlers for an image field that uploads to Cloudinary and is
 * cropped non-destructively (avatar and banner). Picking or adjusting commits
 * immediately via `persist` (keeping the raw source + crop so the editor can be
 * reopened); the consumer supplies the `transform` (crop → delivery URL),
 * `persist` action, and a `label` for toasts.
 */
export function useCropField(opts: {
    initialUrl: string | null;
    initialSourceUrl: string | null;
    initialCrop: AvatarCrop | null;
    transform: (src: string, crop: AvatarCrop) => string;
    persist: (payload: CropPayload) => Promise<ActionResult>;
    label: string;
}) {
    const { transform, persist, label } = opts;
    const router = useRouter();
    const [url, setUrl] = useState(opts.initialUrl);
    const [sourceUrl, setSourceUrl] = useState(opts.initialSourceUrl);
    const [crop, setCrop] = useState<AvatarCrop | null>(opts.initialCrop);
    const [uploading, setUploading] = useState(false);

    // `editorSrc` is the image being cropped (a local object URL for a freshly
    // picked file, or the stored source URL when re-adjusting); `pendingFile` is
    // set only in the former case.
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorSrc, setEditorSrc] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    // The image to (re-)crop: the stored raw source when we have one, otherwise
    // the raw image recovered from the baked URL — so images saved before the
    // editor (no stored source) can still be re-cropped.
    const editSource = sourceUrl ?? (url ? originalUrl(url) : null);

    function openForFile(file: File) {
        // Revoke any prior object URL before replacing it.
        if (pendingFile && editorSrc) URL.revokeObjectURL(editorSrc);
        setPendingFile(file);
        setEditorSrc(URL.createObjectURL(file));
        setEditorOpen(true);
    }

    function openForExisting() {
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
            // For a freshly picked file, upload to get a raw source; otherwise
            // crop the source the editor was opened on.
            let src = editorSrc;
            if (pendingFile) {
                setUploading(true);
                const res = await uploadToCloudinary(pendingFile);
                src = res.secureUrl;
            }
            if (!src) return;
            const nextUrl = transform(src, pixels);
            const result = await persist({ url: nextUrl, sourceUrl: src, crop: pixels });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            setSourceUrl(src);
            setCrop(pixels);
            setUrl(nextUrl);
            toast.success(`${label} updated`);
            router.refresh();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : `Couldn't update ${label.toLowerCase()}`
            );
        } finally {
            setUploading(false);
            closeEditor();
        }
    }

    async function remove() {
        try {
            const result = await persist({ url: null, sourceUrl: null, crop: null });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            setUrl(null);
            setSourceUrl(null);
            setCrop(null);
            toast.success(`${label} removed`);
            router.refresh();
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : `Couldn't remove ${label.toLowerCase()}`
            );
        }
    }

    return {
        url,
        sourceUrl,
        crop,
        uploading,
        editorOpen,
        editorSrc,
        pendingFile,
        editSource,
        openForFile,
        openForExisting,
        closeEditor,
        onCropComplete,
        remove
    };
}
