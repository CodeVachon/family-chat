"use client";

import { useState } from "react";

import { Lightbox } from "@/components/channels/lightbox";
import { thumbUrl } from "@/lib/cloudinary/url";
import { cn } from "@workspace/ui/lib/utils";

export type GalleryImage = {
    id: string;
    secureUrl: string;
    /** Natural dimensions as reported by Cloudinary at upload. Optional because
     * they can be absent on older rows and on non-Cloudinary URLs. */
    width?: number | null;
    height?: number | null;
};

/** Reserved shape for an image whose natural dimensions we don't know. Anything
 * is better than none: an unsized `<img>` is 0px tall until it decodes, so the
 * message row grows underneath the reader and shoves the scroll position. */
const FALLBACK_ASPECT_RATIO = "4 / 3";

/** CSS `aspect-ratio` for a single inline image, so its row occupies its final
 * height on first paint. Combined with `max-h-80`, a very tall image reserves
 * exactly the capped height it will render at. */
function aspectRatioOf(image: GalleryImage): string {
    return image.width && image.height ? `${image.width} / ${image.height}` : FALLBACK_ASPECT_RATIO;
}

export function ImageGallery({ images }: { images: GalleryImage[] }) {
    const [index, setIndex] = useState<number | null>(null);

    if (images.length === 0) return null;

    const visible = images.slice(0, 4);
    const extra = images.length - visible.length;
    const single = images.length === 1;

    return (
        <>
            <div className={cn("mt-1 grid max-w-md gap-1", single ? "grid-cols-1" : "grid-cols-2")}>
                {visible.map((img, i) => {
                    const isLastVisible = i === visible.length - 1;
                    return (
                        <button
                            key={img.id}
                            type="button"
                            onClick={() => setIndex(i)}
                            // A single image sizes to its own aspect ratio; a grid of
                            // them is square. Either way the height is known before the
                            // image loads, so nothing below it shifts.
                            style={single ? { aspectRatio: aspectRatioOf(img) } : undefined}
                            className={cn(
                                "relative w-full overflow-hidden rounded-lg border bg-muted",
                                single ? "max-h-80" : "aspect-square"
                            )}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={thumbUrl(img.secureUrl)}
                                alt=""
                                width={img.width ?? undefined}
                                height={img.height ?? undefined}
                                loading="lazy"
                                decoding="async"
                                className={cn(
                                    "size-full",
                                    single ? "max-h-80 object-contain" : "object-cover"
                                )}
                            />
                            {isLastVisible && extra > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
                                    +{extra}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <Lightbox
                images={images}
                index={index}
                onIndexChange={setIndex}
                onClose={() => setIndex(null)}
            />
        </>
    );
}
