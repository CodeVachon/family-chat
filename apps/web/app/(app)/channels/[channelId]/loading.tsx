import { Skeleton } from "@workspace/ui/components/skeleton";

export default function ChannelLoading() {
    return (
        <div data-component="ChannelLoading" className="flex h-full min-h-0 flex-col">
            <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex flex-1 flex-col gap-4 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-3/4" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
