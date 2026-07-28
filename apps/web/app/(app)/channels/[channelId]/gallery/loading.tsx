import { Skeleton } from "@workspace/ui/components/skeleton";

/** Grid skeleton. The channel header comes from the segment layout, so it stays
 * on screen while this streams. */
export default function ChannelGalleryLoading() {
    return (
        <div data-component="ChannelGalleryLoading" className="h-full overflow-hidden">
            <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
}
