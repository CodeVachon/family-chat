import Link from "next/link";

import { ChannelIcon } from "@/components/channels/channel-icon";
import { Timestamp } from "@/components/preferences/user-prefs";
import { UserName } from "@/components/user/user-identity";
import type { ChannelActivity } from "@/lib/queries/channels";

function ChannelActivityCard({ channel }: { channel: ChannelActivity }) {
    return (
        <Link
            data-component="ChannelActivityCard"
            href={`/channels/${channel.id}`}
            className="block rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40"
        >
            <div className="flex items-center gap-2">
                <ChannelIcon
                    icon={channel.icon}
                    color={channel.color}
                    className="size-4 shrink-0"
                />
                <span className="truncate font-heading text-sm font-semibold">{channel.name}</span>
                {channel.unreadCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                        {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                    </span>
                )}
            </div>

            {channel.previews.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No messages yet.</p>
            ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                    {channel.previews.map((preview) => (
                        <li key={preview.id} className="flex items-baseline gap-2 text-sm">
                            <UserName
                                name={preview.authorName}
                                colorHue={preview.authorHue}
                                className="shrink-0 text-xs"
                            />
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                {preview.snippet}
                            </span>
                            <Timestamp
                                date={preview.createdAt}
                                className="shrink-0 text-xs text-muted-foreground"
                            />
                        </li>
                    ))}
                </ul>
            )}
        </Link>
    );
}

export function ChannelActivityFeed({ channels }: { channels: ChannelActivity[] }) {
    if (channels.length === 0) {
        return (
            <div
                data-component="ChannelActivityFeed"
                className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
            >
                <h2 className="font-heading text-lg font-semibold">No channels yet</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                    Create a channel from the sidebar to start a conversation.
                </p>
            </div>
        );
    }

    return (
        <div data-component="ChannelActivityFeed" className="h-full overflow-y-auto p-4">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
                <h1 className="font-heading text-lg font-semibold">Recent activity</h1>
                {channels.map((channel) => (
                    <ChannelActivityCard key={channel.id} channel={channel} />
                ))}
            </div>
        </div>
    );
}
