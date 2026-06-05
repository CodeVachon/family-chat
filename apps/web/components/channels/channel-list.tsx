"use client";

import { Lock, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ChannelDialog } from "@/components/channels/channel-dialog";
import { ChannelIcon } from "@/components/channels/channel-icon";
import type { ChannelRole } from "@/lib/permissions";
import { cn } from "@workspace/ui/lib/utils";

export type SidebarChannel = {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    isPrivate: boolean;
    isArchived: boolean;
    myRole: ChannelRole | null;
};

function ChannelLink({ channel, active }: { channel: SidebarChannel; active: boolean }) {
    return (
        <Link
            href={`/channels/${channel.id}`}
            onClick={() => undefined}
            className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                channel.isArchived && "opacity-60"
            )}
        >
            <ChannelIcon icon={channel.icon} color={channel.color} className="size-4 shrink-0" />
            <span className="truncate">{channel.name}</span>
            {channel.isPrivate && <Lock className="ml-auto size-3 shrink-0 opacity-70" />}
        </Link>
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
    const archived = channels.filter((c) => c.isArchived);

    return (
        <div className="flex flex-col gap-1" onClick={onNavigate}>
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
            {active.map((c) => (
                <ChannelLink key={c.id} channel={c} active={c.id === activeId} />
            ))}

            {archived.length > 0 && (
                <>
                    <span className="mt-3 px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Archived
                    </span>
                    {archived.map((c) => (
                        <ChannelLink key={c.id} channel={c} active={c.id === activeId} />
                    ))}
                </>
            )}
        </div>
    );
}
