"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { fullUrl } from "@/lib/cloudinary/url";
import { Dialog, DialogContent } from "@workspace/ui/components/dialog";

export function Lightbox({
    images,
    index,
    onIndexChange,
    onClose
}: {
    images: { id: string; secureUrl: string }[];
    index: number | null;
    onIndexChange: (index: number) => void;
    onClose: () => void;
}) {
    const open = index !== null;
    const touchStartX = useRef<number | null>(null);

    const go = useCallback(
        (delta: number) => {
            if (index === null) return;
            const next = (index + delta + images.length) % images.length;
            onIndexChange(next);
        },
        [index, images.length, onIndexChange]
    );

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") go(-1);
            else if (e.key === "ArrowRight") go(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, go]);

    const current = index !== null ? images[index] : null;
    const hasMultiple = images.length > 1;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                showCloseButton
                className="flex h-[90vh] max-w-[95vw] items-center justify-center border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[95vw]"
            >
                {current && (
                    <div
                        className="relative flex size-full items-center justify-center"
                        onTouchStart={(e) => (touchStartX.current = e.touches[0]?.clientX ?? null)}
                        onTouchEnd={(e) => {
                            if (touchStartX.current === null) return;
                            const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
                            if (Math.abs(dx) > 50) go(dx > 0 ? -1 : 1);
                            touchStartX.current = null;
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={fullUrl(current.secureUrl)}
                            alt=""
                            className="max-h-[90vh] max-w-full rounded-lg object-contain"
                        />
                        {hasMultiple && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Previous"
                                    onClick={() => go(-1)}
                                    className="absolute left-2 flex size-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                                >
                                    <ChevronLeft className="size-5" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Next"
                                    onClick={() => go(1)}
                                    className="absolute right-2 flex size-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                                >
                                    <ChevronRight className="size-5" />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
