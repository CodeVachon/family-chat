"use client";

import { useState } from "react";

import { Lightbox } from "@/components/channels/lightbox";
import { thumbUrl } from "@/lib/cloudinary/url";
import type { ProfileFile } from "@/lib/queries/profile";

/**
 * Profile "Files" grid. Image files open in the same in-app lightbox used by
 * channel messages (overlay + arrow/swipe navigation across all the user's
 * images); non-image files keep the open-in-new-tab behavior.
 */
export function ProfileFiles({ files }: { files: ProfileFile[] }) {
    const [index, setIndex] = useState<number | null>(null);

    // Images, in display order, are what the lightbox navigates through.
    const images = files
        .filter((f) => f.kind === "image")
        .map((f) => ({ id: f.id, secureUrl: f.secureUrl }));
    const imageIndexById = new Map(images.map((img, i) => [img.id, i]));

    return (
        <div data-component="ProfileFiles" className="grid grid-cols-3 gap-2">
            {files.map((f) =>
                f.kind === "image" ? (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setIndex(imageIndexById.get(f.id) ?? 0)}
                        className="aspect-square overflow-hidden rounded-lg border bg-muted"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={thumbUrl(f.secureUrl)}
                            alt={f.originalFilename ?? ""}
                            className="size-full object-cover"
                        />
                    </button>
                ) : (
                    <a
                        key={f.id}
                        href={f.secureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={f.originalFilename ?? undefined}
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border bg-muted p-2 text-center text-[10px] text-muted-foreground hover:bg-muted/70"
                    >
                        <span className="font-medium uppercase">{f.kind}</span>
                        <span className="line-clamp-2 break-all">
                            {f.originalFilename ?? "file"}
                        </span>
                    </a>
                )
            )}

            <Lightbox
                images={images}
                index={index}
                onIndexChange={setIndex}
                onClose={() => setIndex(null)}
            />
        </div>
    );
}
