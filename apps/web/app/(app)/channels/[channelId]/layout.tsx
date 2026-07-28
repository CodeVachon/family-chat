import { ChannelHeader } from "@/components/channels/channel-header";
import { ChannelHeaderGate } from "@/components/channels/channel-header-gate";
import { ChannelSettingsFromUrl } from "@/components/channels/channel-settings-from-url";
import { authorizeChannel } from "@/lib/dal";
import { canInChannel } from "@/lib/permissions";
import { listChannelMembers, toChannelMembers } from "@/lib/queries/channels";
import { listApprovedUsers } from "@/lib/queries/users";

/**
 * Shared chrome for a channel's views (messages and gallery).
 *
 * The header lives here rather than in each page so that switching between the
 * message view and the gallery leaves it in place — no re-mount, and no flash of
 * a headerless skeleton while the next view streams in.
 *
 * `authorizeChannel` runs here as well as in each page. It's request-memoized so
 * the second call is free, and each page still authorizes independently rather
 * than trusting the layout — a layout is not a security boundary.
 */
export default async function ChannelLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ channelId: string }>;
}) {
    const { channelId } = await params;
    const { user, channel, membership } = await authorizeChannel(channelId, "channel:view");

    const canManage = canInChannel(user, membership, channel, "channel:edit_settings");
    const canManageMembers = canInChannel(user, membership, channel, "channel:manage_members");

    const [memberRows, approvedUsers] = await Promise.all([
        listChannelMembers(channelId),
        canManageMembers ? listApprovedUsers() : Promise.resolve([])
    ]);

    const members = toChannelMembers(memberRows);

    const memberIds = new Set(memberRows.map((m) => m.userId));
    const addableUsers = approvedUsers.filter((u) => !memberIds.has(u.id));

    return (
        <div data-component="ChannelLayout" className="flex h-full min-h-0 flex-col">
            <ChannelHeaderGate>
                <ChannelHeader
                    channel={channel}
                    canManage={canManage}
                    canManageMembers={canManageMembers}
                    members={members}
                    addableUsers={addableUsers}
                />
            </ChannelHeaderGate>

            <div className="min-h-0 flex-1">{children}</div>

            {/* Channel settings is a URL-driven dialog (`?settings=1`) so it can be
                opened from a plain link in the header menu, and so it survives a
                refresh and closes on Back. Mounted at the layout level so it works
                from the gallery as well as the message view. */}
            {canManage && (
                <ChannelSettingsFromUrl
                    channel={{
                        id: channel.id,
                        name: channel.name,
                        description: channel.description,
                        color: channel.color,
                        icon: channel.icon,
                        isPrivate: channel.isPrivate,
                        isArchived: channel.isArchived
                    }}
                />
            )}
        </div>
    );
}
