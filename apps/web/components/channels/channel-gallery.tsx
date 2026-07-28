"use client";

import { Images, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Lightbox } from "@/components/channels/lightbox";
import { UserAvatar } from "@/components/user/user-identity";
import { thumbUrl } from "@/lib/cloudinary/url";
import { loadMoreChannelImages } from "@/lib/actions/channel-images";
import type { ChannelImage } from "@/lib/queries/channels";

/** One image in the grid. `createdAt` is already an ISO string — see
 * {@link ChannelImage}. */
export type GalleryItem = ChannelImage;

const dayFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
});

type DayGroup = {
    key: string;
    label: string;
    images: GalleryItem[];
    /** Index of this group's first image in the flat list, which is what the
     * lightbox pages through. Precomputed so render needn't accumulate it. */
    startIndex: number;
};

/** Images bucketed into the calendar days they were posted on, order preserved. */
function groupByDay(images: GalleryItem[]): DayGroup[] {
    const groups: DayGroup[] = [];

    images.forEach((image, index) => {
        const date = new Date(image.createdAt);
        // Local calendar day, so a group header matches the date the viewer sees
        // on the message itself.
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const last = groups[groups.length - 1];
        if (last?.key === key) {
            last.images.push(image);
        } else {
            groups.push({
                key,
                label: dayFormatter.format(date),
                images: [image],
                startIndex: index
            });
        }
    });

    return groups;
}

/**
 * Every image in a channel, oldest first, as a scrollable grid of day-grouped
 * thumbnails that opens into the shared {@link Lightbox}.
 *
 * Pages forward on scroll. The lightbox is handed the whole loaded set, so paging
 * past the last thumbnail is possible without pre-loading the entire channel.
 */
export function ChannelGallery({
    channelId,
    initialImages,
    initialHasMore,
    total
}: {
    channelId: string;
    initialImages: GalleryItem[];
    initialHasMore: boolean;
    total: number;
}) {
    const [images, setImages] = useState(initialImages);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loading, setLoading] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const sentinel = useRef<HTMLDivElement | null>(null);

    const loadMore = useCallback(async () => {
        // `loading` is read through the setter-free guard below, so this callback
        // stays stable and doesn't churn the observer.
        setLoading(true);
        try {
            const page = await loadMoreChannelImages(channelId, images.length);
            setImages((current) => {
                // Dedupe by id: a concurrent upload can shift the offset window,
                // and a repeated row must not render twice.
                const seen = new Set(current.map((i) => i.id));
                const fresh = page.images.filter((i) => !seen.has(i.id));
                return fresh.length > 0 ? [...current, ...fresh] : current;
            });
            setHasMore(page.hasMore);
        } catch {
            // Stop paging rather than spinning forever on a failing request.
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [channelId, images.length]);

    useEffect(() => {
        const node = sentinel.current;
        if (!node || !hasMore || loading) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) void loadMore();
            },
            // Start fetching a screenful early so scrolling doesn't stall.
            { rootMargin: "600px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, loading, loadMore]);

    const groups = useMemo(() => groupByDay(images), [images]);
    const lightboxImages = useMemo(
        () => images.map((i) => ({ id: i.id, secureUrl: i.secureUrl })),
        [images]
    );

    if (images.length === 0) {
        return (
            <div
                data-component="ChannelGallery"
                className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
            >
                <Images className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    No photos have been shared in this channel yet.
                </p>
            </div>
        );
    }

    return (
        <div data-component="ChannelGallery" className="h-full overflow-y-auto">
            <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
                <p className="text-sm text-muted-foreground">
                    {total} {total === 1 ? "photo" : "photos"}, oldest first
                </p>

                {groups.map((group) => (
                    <section key={group.key} className="flex flex-col gap-2">
                        <h2 className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-1 text-sm font-semibold backdrop-blur">
                            {group.label}
                        </h2>
                        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                            {group.images.map((image, i) => (
                                <GalleryThumb
                                    key={image.id}
                                    image={image}
                                    onOpen={() => setLightboxIndex(group.startIndex + i)}
                                />
                            ))}
                        </div>
                    </section>
                ))}

                {/* Paging sentinel — also the loading indicator. */}
                {hasMore && (
                    <div ref={sentinel} className="flex justify-center py-6">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>

            <Lightbox
                images={lightboxImages}
                index={lightboxIndex}
                onIndexChange={setLightboxIndex}
                onClose={() => setLightboxIndex(null)}
            />
        </div>
    );
}

function GalleryThumb({ image, onOpen }: { image: GalleryItem; onOpen: () => void }) {
    return (
        <button
            data-component="GalleryThumb"
            type="button"
            onClick={onOpen}
            title={`Shared by ${image.uploader.name}`}
            className="group relative aspect-square overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={thumbUrl(image.secureUrl)}
                alt={`Shared by ${image.uploader.name}`}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition-transform group-hover:scale-105"
            />
            {/* Who shared it — the point of a multi-person holiday gallery. Shown on
                hover/focus so the grid stays clean, and always on touch, which has
                no hover state. */}
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100">
                <UserAvatar
                    name={image.uploader.name}
                    colorHue={image.uploader.colorHue}
                    avatarUrl={image.uploader.avatarUrl}
                    className="size-4 text-[8px]"
                />
                <span className="truncate text-[10px] font-medium text-white">
                    {image.uploader.name}
                </span>
            </span>
        </button>
    );
}
