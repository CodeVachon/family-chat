"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@workspace/ui/lib/utils";

const TABS = [
    { href: "/admin/approvals", label: "Approvals" },
    { href: "/admin/users", label: "Users" }
];

export function AdminNav() {
    const pathname = usePathname();

    return (
        <nav className="mb-6 inline-flex gap-1 rounded-lg bg-muted p-1">
            {TABS.map((tab) => {
                const active = pathname.startsWith(tab.href);
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            active
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
