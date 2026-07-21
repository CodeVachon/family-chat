"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ConnectionBanner } from "@/components/app/connection-banner";
import { FaviconBadge } from "@/components/app/favicon-badge";
import {
    MobileSidebarProvider,
    SidebarToggle,
    useMobileSidebar
} from "@/components/app/mobile-sidebar";
import { QuickSwitcher } from "@/components/app/quick-switcher";
import { UserMenu } from "@/components/app/user-menu";
import { ChannelList, type SidebarChannel } from "@/components/channels/channel-list";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@workspace/ui/components/sheet";

type ShellUser = {
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

type ShellContentProps = {
    user: ShellUser;
    channels: SidebarChannel[];
    canAccessAdmin: boolean;
    pendingApprovals: number;
    appName: string;
    appIconUrl: string | null;
};

/** The mobile sidebar drawer, mounted once and controlled via context so its
 * toggle can live in the channel header or a top-level page header. */
function MobileDrawer(props: ShellContentProps) {
    const { open, setOpen } = useMobileSidebar();
    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContents {...props} onNavigate={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    );
}

export function AppShell({
    children,
    ...props
}: ShellContentProps & {
    children: React.ReactNode;
}) {
    const { channels, appName, appIconUrl } = props;
    const totalUnread = channels.reduce((sum, c) => sum + c.unreadCount, 0);

    // The channel view (/channels/<id>) has its own header carrying the sidebar
    // toggle, so the mobile top bar is dropped there to give the messages pane
    // that height. Other routes (the /channels feed, settings, admin) lack a
    // channel header, so they keep the top bar as the toggle's home.
    const pathname = usePathname();
    const isChannelView = /^\/channels\/[^/]+/.test(pathname ?? "");

    return (
        <MobileSidebarProvider>
            <div data-component="AppShell" className="grid h-svh md:grid-cols-[16rem_1fr]">
                <FaviconBadge count={totalUnread} />
                <QuickSwitcher channels={channels} />
                {/* Desktop sidebar */}
                <aside className="hidden border-r bg-card md:block">
                    <SidebarContents {...props} />
                </aside>

                {/* Mobile sidebar drawer (mounted once; opened via SidebarToggle) */}
                <MobileDrawer {...props} />

                <div className="flex h-svh min-h-0 min-w-0 flex-col">
                    {/* Mobile top bar — only on routes without their own header */}
                    {!isChannelView && (
                        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:hidden">
                            <SidebarToggle />
                            <span className="flex items-center gap-2 font-heading text-base font-semibold">
                                {appIconUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={appIconUrl} alt="" className="size-5 rounded" />
                                )}
                                {appName}
                            </span>
                        </header>
                    )}

                    <ConnectionBanner />
                    <main className="min-h-0 flex-1">{children}</main>
                </div>
            </div>
        </MobileSidebarProvider>
    );
}
