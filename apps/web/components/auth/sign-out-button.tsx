"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";

export function SignOutButton({
    variant = "outline",
    className,
    children
}: {
    variant?: React.ComponentProps<typeof Button>["variant"];
    className?: string;
    children?: React.ReactNode;
}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);

    async function handleSignOut() {
        setPending(true);
        await authClient.signOut();
        router.push("/login");
        router.refresh();
    }

    return (
        <Button
            type="button"
            variant={variant}
            className={className}
            onClick={handleSignOut}
            disabled={pending}
        >
            {children ?? (pending ? "Signing out…" : "Sign out")}
        </Button>
    );
}
