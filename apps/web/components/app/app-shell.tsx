"use client";

import { Home, Menu, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";
import { cn } from "@workspace/ui/lib/utils";

export type ShellUser = {
    name: string;
    email: string;
    appRole: string;
    colorHue: number;
};

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function getNavItems(canAccessAdmin: boolean): NavItem[] {
    const items: NavItem[] = [{ href: "/", label: "Home", icon: Home }];
    if (canAccessAdmin) {
        items.push({ href: "/admin", label: "Admin", icon: ShieldCheck });
    }
    return items;
}

function initials(name: string): string {
    return (
        name
            .split(/\s+/)
            .map((part) => part[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase() || "?"
    );
}

function SidebarContents({
    user,
    items,
    pathname,
    onNavigate
}: {
    user: ShellUser;
    items: NavItem[];
    pathname: string;
    onNavigate?: () => void;
}) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
                <span className="font-heading text-lg font-semibold">Family Chat</span>
            </div>
            <nav className="flex-1 space-y-1 p-2">
                {items.map((item) => {
                    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                active
                                    ? "bg-muted text-foreground"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                        >
                            <Icon className="size-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="border-t p-3">
                <div className="flex items-center gap-2">
                    <Avatar
                        className="ring-2 ring-[color:var(--user-color)]"
                        style={{ ["--user-color" as string]: `oklch(var(--user-l) var(--user-c) ${user.colorHue})` }}
                    >
                        <AvatarFallback>{initials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <p
                            className="truncate text-sm font-medium"
                            style={{
                                color: `oklch(var(--user-l) var(--user-c) ${user.colorHue})`
                            }}
                        >
                            {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                </div>
                <SignOutButton variant="outline" className="mt-3 w-full" />
            </div>
        </div>
    );
}

export function AppShell({
    user,
    canAccessAdmin,
    children
}: {
    user: ShellUser;
    canAccessAdmin: boolean;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const items = getNavItems(canAccessAdmin);

    return (
        <div className="grid min-h-svh md:grid-cols-[16rem_1fr]">
            {/* Desktop sidebar */}
            <aside className="hidden border-r bg-card md:block">
                <SidebarContents user={user} items={items} pathname={pathname} />
            </aside>

            <div className="flex min-h-svh flex-col">
                {/* Mobile header */}
                <header className="flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger
                            className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted"
                            aria-label="Open menu"
                        >
                            <Menu className="size-5" />
                        </SheetTrigger>
                        <SheetContent side="left" className="w-64 p-0">
                            <SheetTitle className="sr-only">Navigation</SheetTitle>
                            <SidebarContents
                                user={user}
                                items={items}
                                pathname={pathname}
                                onNavigate={() => setMobileOpen(false)}
                            />
                        </SheetContent>
                    </Sheet>
                    <span className="font-heading text-base font-semibold">Family Chat</span>
                </header>

                <main className="flex-1">{children}</main>
            </div>
        </div>
    );
}
