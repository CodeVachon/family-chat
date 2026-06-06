"use client";

import { useState } from "react";

import { Lightbox } from "@/components/channels/lightbox";
import { thumbUrl } from "@/lib/cloudinary/url";
import { cn } from "@workspace/ui/lib/utils";

export type GalleryImage = { id: string; secureUrl: string };

export function ImageGallery({ images }: { images: GalleryImage[] }) {
    const [index, setIndex] = useState<number | null>(null);

    if (images.length === 0) return null;

    const visible = images.slice(0, 4);
    const extra = images.length - visible.length;
    const single = images.length === 1;

    return (
        <>
            <div
                className={cn(
                    "mt-1 grid max-w-md gap-1",
                    single ? "grid-cols-1" : "grid-cols-2"
                )}
            >
                {visible.map((img, i) => {
                    const isLastVisible = i === visible.length - 1;
                    return (
                        <button
                            key={img.id}
                            type="button"
                            onClick={() => setIndex(i)}
                            className={cn(
                                "relative overflow-hidden rounded-lg border bg-muted",
                                single ? "max-h-80" : "aspect-square"
                            )}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={thumbUrl(img.secureUrl)}
                                alt=""
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
