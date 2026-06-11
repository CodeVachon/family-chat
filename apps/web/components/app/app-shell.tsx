"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConnectionBanner } from "@/components/app/connection-banner";
import { FaviconBadge } from "@/components/app/favicon-badge";
import { QuickSwitcher } from "@/components/app/quick-switcher";
import { UserMenu } from "@/components/app/user-menu";
import { ChannelList, type SidebarChannel } from "@/components/channels/channel-list";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";

export type ShellUser = {
    name: string;
    email: string;
    appRole: string;
    colorHue: number;
    avatarUrl: string | null;
};

function SidebarContents({
    user,
    channels,
    canAccessAdmin,
    pendingApprovals,
    appName,
    appIconUrl,
    onNavigate
}: {
    user: ShellUser;
    channels: SidebarChannel[];
    canAccessAdmin: boolean;
    pendingApprovals: number;
    appName: string;
    appIconUrl: string | null;
    onNavigate?: () => void;
}) {
    return (
        <div data-component="SidebarContents" className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
                <Link
                    href="/channels"
                    onClick={onNavigate}
                    className="flex items-center gap-2 font-heading text-lg font-semibold"
                >
                    {appIconUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={appIconUrl} alt="" className="size-6 rounded" />
                    )}
                    <span className="truncate">{appName}</span>
                </Link>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2">
                    <ChannelList channels={channels} canCreate onNavigate={onNavigate} />
                </div>
            </ScrollArea>

            <div className="border-t" data-component="Sidebar-User-Menu">
                <UserMenu
                    user={{
                        name: user.name,
                        email: user.email,
                        colorHue: user.colorHue,
                        avatarUrl: user.avatarUrl
                    }}
                    canAccessAdmin={canAccessAdmin}
                    pendingApprovals={pendingApprovals}
                    onNavigate={onNavigate}
                />
            </div>
        </div>
    );
}

export function AppShell({
    user,
    channels,
    canAccessAdmin,
    pendingApprovals,
    appName,
    appIconUrl,
    children
}: {
    user: ShellUser;
    channels: SidebarChannel[];
    canAccessAdmin: boolean;
    pendingApprovals: number;
    appName: string;
    appIconUrl: string | null;
    children: React.ReactNode;
}) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const totalUnread = channels.reduce((sum, c) => sum + c.unreadCount, 0);

    return (
        <div data-component="AppShell" className="grid h-svh md:grid-cols-[16rem_1fr]">
            <FaviconBadge count={totalUnread} />
            <QuickSwitcher channels={channels} />
            {/* Desktop sidebar */}
            <aside className="hidden border-r bg-card md:block">
                <SidebarContents
                    user={user}
                    channels={channels}
                    canAccessAdmin={canAccessAdmin}
                    pendingApprovals={pendingApprovals}
                    appName={appName}
                    appIconUrl={appIconUrl}
                />
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
                                pendingApprovals={pendingApprovals}
                                appName={appName}
                                appIconUrl={appIconUrl}
                                onNavigate={() => setMobileOpen(false)}
                            />
                        </SheetContent>
                    </Sheet>
                    <span className="flex items-center gap-2 font-heading text-base font-semibold">
                        {appIconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={appIconUrl} alt="" className="size-5 rounded" />
                        )}
                        {appName}
                    </span>
                </header>

                <ConnectionBanner />
                <main className="min-h-0 flex-1">{children}</main>
            </div>
        </div>
    );
}
