import { Skeleton } from "@workspace/ui/components/skeleton";

/**
 * Fallback for routes inside the app shell that don't define their own. It sits
 * *inside* `AppShell`, so the sidebar stays put and only the content pane swaps —
 * without it, an in-app navigation would fall back to the root boundary and flash
 * the full-screen splash.
 */
export default function AppSegmentLoading() {
    return (
        <div data-component="AppSegmentLoading" className="flex flex-col gap-4 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="mt-2 flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full max-w-2xl" />
                ))}
            </div>
        </div>
    );
}
