"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { PdfPageViewer } from "@/components/channels/pdf-page-viewer";
import { pdfThumbUrl } from "@/lib/cloudinary/url";
import { formatBytes } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";

export type PdfAttachmentData = {
    id: string;
    secureUrl: string;
    resourceType: string;
    originalFilename: string | null;
    bytes: number | null;
    /** Page dimensions Cloudinary reported for the first page. Optional — absent
     * on older rows. */
    width?: number | null;
    height?: number | null;
};

/** Portrait letter, the overwhelmingly common case, for documents whose page
 * dimensions we don't know. Reserving the wrong height still beats reserving
 * none: an unsized preview is 0px tall until it decodes and then shoves
 * everything below it down. */
const FALLBACK_ASPECT_RATIO = "8.5 / 11";

export function PdfAttachment({ attachment }: { attachment: PdfAttachmentData }) {
    const [open, setOpen] = useState(false);
    const [thumbFailed, setThumbFailed] = useState(false);
    const name = attachment.originalFilename ?? "document.pdf";
    const meta = ["PDF", formatBytes(attachment.bytes)].filter(Boolean).join(" · ");
    const showThumb = attachment.resourceType === "image" && !thumbFailed;
    const aspectRatio =
        attachment.width && attachment.height
            ? `${attachment.width} / ${attachment.height}`
            : FALLBACK_ASPECT_RATIO;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-1 w-56 max-w-full overflow-hidden rounded-lg border bg-card text-left transition-colors hover:bg-muted/50"
            >
                {showThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={pdfThumbUrl(attachment.secureUrl)}
                        alt={`First page of ${name}`}
                        onError={() => setThumbFailed(true)}
                        loading="lazy"
                        decoding="async"
                        // Occupies its final height on first paint rather than
                        // expanding from zero once the render arrives.
                        style={{ aspectRatio }}
                        className="max-h-72 w-full border-b bg-muted object-contain"
                    />
                ) : (
                    <div className="flex h-32 items-center justify-center border-b bg-muted">
                        <FileText className="size-8 text-muted-foreground" />
                    </div>
                )}
                <div className="flex items-center gap-2 p-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">{meta}</p>
                    </div>
                </div>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="flex h-[85vh] w-[95vw] max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl">
                    <DialogHeader className="border-b p-3">
                        <DialogTitle className="truncate pr-8">{name}</DialogTitle>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {open && <PdfPageViewer secureUrl={attachment.secureUrl} />}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
