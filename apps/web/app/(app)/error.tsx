"use client";

import { useEffect } from "react";

import { Button } from "@workspace/ui/components/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("[app error]", error);
    }, [error]);

    return (
        <div
            data-component="AppError"
            className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
        >
            <h2 className="font-heading text-xl font-semibold">Something went wrong</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
                An unexpected error occurred. You can try again, or reload the page.
            </p>
            <Button onClick={reset}>Try again</Button>
        </div>
    );
}
