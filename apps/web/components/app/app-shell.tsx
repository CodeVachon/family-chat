"use client";

import { Menu, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ChannelList, type SidebarChannel } from "@/components/channels/channel-list";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";

export type ShellUser = {
    name: string;
    email: string;
    appRole: string;
    colorHue: number;
};

function SidebarContents({
    user,
    channels,
    canAccessAdmin,
    onNavigate
}: {
    user: ShellUser;
    channels: SidebarChannel[];
    canAccessAdmin: boolean;
    onNavigate?: () => void;
}) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
                <Link href="/channels" onClick={onNavigate} className="font-heading text-lg font-semibold">
                    Family Chat
                </Link>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2">
                    <ChannelList channels={channels} canCreate onNavigate={onNavigate} />
                </div>
            </ScrollArea>

            <div className="border-t p-3">
                {canAccessAdmin && (
                    <Link
                        href="/admin"
                        onClick={onNavigate}
                        className="mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                        <ShieldCheck className="size-4" />
                        Admin
                    </Link>
                )}
                <div className="flex items-center gap-2">
                    <UserAvatar name={user.name} colorHue={user.colorHue} />
                    <div className="min-w-0 flex-1">
                        <UserName
                            name={user.name}
                            colorHue={user.colorHue}
                            className="block truncate text-sm"
                        />
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
    channels,
    canAccessAdmin,
    children
}: {
    user: ShellUser;
    channels: SidebarChannel[];
    canAccessAdmin: boolean;
    children: React.ReactNode;
}) {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="grid h-svh md:grid-cols-[16rem_1fr]">
            {/* Desktop sidebar */}
            <aside className="hidden border-r bg-card md:block">
                <SidebarContents user={user} channels={channels} canAccessAdmin={canAccessAdmin} />
            </aside>

            <div className="flex h-svh min-h-0 flex-col">
                {/* Mobile header */}
                <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:hidden">
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
                                channels={channels}
                                canAccessAdmin={canAccessAdmin}
                                onNavigate={() => setMobileOpen(false)}
                            />
                        </SheetContent>
                    </Sheet>
                    <span className="font-heading text-base font-semibold">Family Chat</span>
                </header>

                <main className="min-h-0 flex-1">{children}</main>
            </div>
        </div>
    );
}
