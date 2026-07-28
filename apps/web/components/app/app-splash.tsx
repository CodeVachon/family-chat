import { Loader2 } from "lucide-react";

/**
 * Full-viewport branded loading state, shown while the app shell streams in.
 *
 * This covers the window between the OS splash tearing down and the first
 * meaningful paint — on a cold start over a slow connection that gap used to be
 * a blank page, which reads as a broken app. Uses theme tokens so it lands on
 * the surface the app is about to render, with no light/dark flash.
 */
export function AppSplash({
    appName,
    appIconUrl
}: {
    appName?: string;
    appIconUrl?: string | null;
}) {
    return (
        <div
            data-component="AppSplash"
            className="flex h-svh flex-col items-center justify-center gap-6 bg-background text-foreground"
        >
            <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={appIconUrl ?? "/icon.svg"} alt="" className="size-16 rounded-2xl" />
                {appName && (
                    <p className="font-heading text-lg font-semibold tracking-tight">{appName}</p>
                )}
            </div>
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only" role="status">
                Loading{appName ? ` ${appName}` : ""}…
            </span>
        </div>
    );
}
