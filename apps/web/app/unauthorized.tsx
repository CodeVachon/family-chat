import Link from "next/link";

import { buttonVariants } from "@workspace/ui/components/button";

export default function Unauthorized() {
    return (
        <div
            data-component="Unauthorized"
            className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center"
        >
            <h1 className="font-heading text-3xl font-semibold">401 — Unauthorized</h1>
            <p className="max-w-md text-muted-foreground">
                You need to sign in to view this page.
            </p>
            <Link href="/login" className={buttonVariants()}>
                Sign in
            </Link>
        </div>
    );
}
