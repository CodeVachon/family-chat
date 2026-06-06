"use client";

import { useState } from "react";

import { pdfPageUrl } from "@/lib/cloudinary/url";

const MAX_PAGES = 50;

/**
 * Renders a PDF as a vertical stack of page images (JPGs from Cloudinary's image
 * pipeline). Pages load sequentially: each successful page probes the next; the
 * first error past page 1 marks the end. This avoids embedding the original PDF
 * (whose delivery Cloudinary blocks by default).
 */
export function PdfPageViewer({ secureUrl }: { secureUrl: string }) {
    const [count, setCount] = useState(1);
    const [done, setDone] = useState(false);
    const [firstPageFailed, setFirstPageFailed] = useState(false);

    function handleLoad(page: number) {
        if (!done && page === count && count < MAX_PAGES) setCount(page + 1);
    }

    function handleError(page: number) {
        if (page === 1) {
            setFirstPageFailed(true);
            setDone(true);
            return;
        }
        setDone(true);
        setCount(page - 1); // drop the non-existent frontier page
    }

    if (firstPageFailed) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Couldn&apos;t render this PDF. Make sure &ldquo;Allow delivery of PDF and ZIP
                files&rdquo; is enabled in Cloudinary.
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-3 bg-muted/40 p-3">
            {Array.from({ length: count }, (_, i) => i + 1).map((page) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={page}
                    src={pdfPageUrl(secureUrl, page)}
                    alt={`Page ${page}`}
                    onLoad={() => handleLoad(page)}
                    onError={() => handleError(page)}
                    className="w-full max-w-3xl rounded border bg-white shadow-sm"
                />
            ))}
        </div>
    );
}
