"use client";

import { Check, EllipsisVertical, Images, MessageSquare, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Badge } from "@workspace/ui/components/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";

/**
 * Channel ⇄ Gallery navigation, plus the channel-settings entry point.
 *
 * Two presentations, because the header is `h-14` and already carries the sidebar
 * toggle, channel icon, name and member avatars:
 *  - below `md` there's no room for a segmented control, so everything collapses
 *    into one overflow menu (which is also why the settings gear isn't rendered
 *    separately at that size).
 *  - from `md` up the space exists, and a two-click path to switch views would
 *    feel worse than the single click a visible toggle gives.
 */
export function ChannelNav({ channelId, canManage }: { channelId: string; canManage: boolean }) {
    const router = useRouter();
    const pathname = usePathname();

    const channelHref = `/channels/${channelId}`;
    const galleryHref = `${channelHref}/gallery`;
    const onGallery = pathname === galleryHref;

    // Settings is a search param on whichever view you're in, so it opens over the
    // gallery as readily as over the messages. Pushed (not replaced) so Back closes.
    const openSettings = () => router.push(`${pathname}?settings=1`);

    return (
        <>
            {/* Mobile: one tap for everything */}
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label="Channel menu"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
                >
                    <EllipsisVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => router.push(channelHref)}>
                        <MessageSquare className="size-4" />
                        Channel
                        {!onGallery && <Check className="ml-auto size-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(galleryHref)}>
                        <Images className="size-4" />
                        Gallery
                        {onGallery && <Check className="ml-auto size-4" />}
                    </DropdownMenuItem>
                    {canManage && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={openSettings}>
                                <Settings className="size-4" />
                                Settings
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop: a visible toggle, one click either way */}
            <nav
                data-component="ChannelNav"
                aria-label="Channel views"
                className="hidden shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5 md:flex"
            >
                <ChannelNavTab href={channelHref} active={!onGallery} label="Channel">
                    <MessageSquare className="size-4" />
                </ChannelNavTab>
                <ChannelNavTab href={galleryHref} active={onGallery} label="Gallery">
                    <Images className="size-4" />
                </ChannelNavTab>
            </nav>
        </>
    );
}

/**
 * Names the active view in the header. Only below `md`, where {@link ChannelNav}
 * has collapsed into an overflow menu and can no longer show which view you're in
 * without being opened.
 */
export function ChannelViewLabel({ channelId }: { channelId: string }) {
    const pathname = usePathname();
    if (pathname !== `/channels/${channelId}/gallery`) return null;

    return (
        <Badge data-component="ChannelViewLabel" variant="secondary" className="shrink-0 md:hidden">
            Gallery
        </Badge>
    );
}

function ChannelNavTab({
    href,
    active,
    label,
    children
}: {
    href: string;
    active: boolean;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <Link
            data-component="ChannelNavTab"
            href={href}
            aria-label={label}
            title={label}
            aria-current={active ? "page" : undefined}
            className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors",
                active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
            )}
        >
            {children}
        </Link>
    );
}
