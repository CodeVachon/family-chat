"use client";

import { Lock, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTransition } from "react";

import { ChannelDialog } from "@/components/channels/channel-dialog";
import { ChannelIcon } from "@/components/channels/channel-icon";
import { toggleChannelFavorite } from "@/lib/actions/favorites";
import type { ChannelRole } from "@/lib/permissions";
import { cn } from "@workspace/ui/lib/utils";

export type SidebarChannel = {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    isPrivate: boolean;
    isArchived: boolean;
    isFavorite: boolean;
    myRole: ChannelRole | null;
    unreadCount: number;
    mentionCount: number;
};

/** Star toggle shown on a channel row. Only rendered for members. Always
 * visible when favorited; otherwise appears on row hover / keyboard focus. */
function FavoriteToggle({ channel }: { channel: SidebarChannel }) {
    const [pending, startTransition] = useTransition();
    return (
        <button
            data-component="FavoriteToggle"
            type="button"
            aria-label={channel.isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={channel.isFavorite}
            disabled={pending}
            onClick={() => startTransition(() => toggleChannelFavorite(channel.id))}
            className={cn(
                "absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded transition-opacity hover:bg-muted",
                channel.isFavorite
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            )}
        >
            <Star
                className={cn(
                    "size-3.5",
                    channel.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                )}
            />
        </button>
    );
}

/** The unread/mention pill shown at the right of a channel row (mention count
 * takes priority over the plain unread count). Renders nothing when caught up. */
function ChannelBadge({ channel }: { channel: SidebarChannel }) {
    if (channel.mentionCount > 0) {
        return (
            <span
                className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white"
                title={`${channel.mentionCount} mention${channel.mentionCount === 1 ? "" : "s"}`}
            >
                @{channel.mentionCount > 99 ? "99+" : channel.mentionCount}
            </span>
        );
    }
    if (channel.unreadCount > 0) {
        return (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
            </span>
        );
    }
    return null;
}

function ChannelLink({
    channel,
    active,
    onNavigate
}: {
    channel: SidebarChannel;
    active: boolean;
    onNavigate?: () => void;
}) {
    const canFavorite = channel.myRole !== null;
    return (
        <div data-component="ChannelLink" className="group relative">
            <Link
                href={`/channels/${channel.id}`}
                onClick={onNavigate}
                className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    channel.isArchived && "opacity-60",
                    // Reserve room on the right for the star when it's shown, so
                    // it never overlaps the channel name or the unread badge.
                    canFavorite && (channel.isFavorite ? "pr-8" : "group-hover:pr-8")
                )}
            >
                <ChannelIcon
                    icon={channel.icon}
                    color={channel.color}
                    className="size-4 shrink-0"
                />
                <span
                    className={cn(
                        "truncate",
                        channel.unreadCount > 0 && !active && "font-semibold text-foreground"
                    )}
                >
                    {channel.name}
                </span>
                {channel.isPrivate && <Lock className="size-3 shrink-0 opacity-70" />}
                <ChannelBadge channel={channel} />
            </Link>
            {canFavorite && <FavoriteToggle channel={channel} />}
        </div>
    );
}

/** A labeled block of channel rows. Renders nothing when the group is empty. */
function ChannelSection({
    label,
    labelClassName,
    channels,
    activeId,
    onNavigate
}: {
    label?: string;
    labelClassName?: string;
    channels: SidebarChannel[];
    activeId?: string;
    onNavigate?: () => void;
}) {
    if (channels.length === 0) return null;
    return (
        <>
            {label && (
                <span
                    className={cn(
                        "px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                        labelClassName
                    )}
                >
                    {label}
                </span>
            )}
            {channels.map((c) => (
                <ChannelLink
                    key={c.id}
                    channel={c}
                    active={c.id === activeId}
                    onNavigate={onNavigate}
                />
            ))}
        </>
    );
}

export function ChannelList({
    channels,
    canCreate,
    onNavigate
}: {
    channels: SidebarChannel[];
    canCreate: boolean;
    onNavigate?: () => void;
}) {
    const params = useParams<{ channelId?: string }>();
    const activeId = params?.channelId;

    const active = channels.filter((c) => !c.isArchived);
    const favorites = active.filter((c) => c.isFavorite);
    const unfavorited = active.filter((c) => !c.isFavorite);
    const archived = channels.filter((c) => c.isArchived);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Channels
                </span>
                {canCreate && (
                    <ChannelDialog
                        trigger={
                            <button
                                type="button"
                                aria-label="Create channel"
                                className="flex size-5 items-center justify-center rounded hover:bg-muted"
                            >
                                <Plus className="size-4" />
                            </button>
                        }
                    />
                )}
            </div>

            {active.length === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">No channels yet.</p>
            )}

            <ChannelSection
                label={favorites.length > 0 ? "Favorites" : undefined}
                channels={favorites}
                activeId={activeId}
                onNavigate={onNavigate}
            />
            <ChannelSection
                // A "Channels" divider only makes sense once favorites are split off.
                label={favorites.length > 0 ? "Channels" : undefined}
                labelClassName="mt-2"
                channels={unfavorited}
                activeId={activeId}
                onNavigate={onNavigate}
            />
            <ChannelSection
                label="Archived"
                labelClassName="mt-3"
                channels={archived}
                activeId={activeId}
                onNavigate={onNavigate}
            />
        </div>
    );
}
