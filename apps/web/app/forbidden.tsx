import Link from "next/link";

import { buttonVariants } from "@workspace/ui/components/button";

export default function Forbidden() {
    return (
        <div
            data-component="Forbidden"
            className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center"
        >
            <h1 className="font-heading text-3xl font-semibold">403 — Forbidden</h1>
            <p className="max-w-md text-muted-foreground">
                You don&apos;t have permission to view this page.
            </p>
            <Link href="/" className={buttonVariants()}>
                Back to home
            </Link>
        </div>
    );
}
