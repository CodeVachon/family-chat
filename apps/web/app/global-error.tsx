"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Catches errors thrown in the root layout (which the route-level error.tsx
 * boundaries can't reach) and reports them to Sentry. Must render its own
 * <html>/<body> since it replaces the root layout when it fires.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html data-component="GlobalError" lang="en">
            <body className="flex min-h-svh items-center justify-center p-4">
                <p className="text-sm text-muted-foreground">
                    Something went wrong. Please refresh the page.
                </p>
            </body>
        </html>
    );
}
