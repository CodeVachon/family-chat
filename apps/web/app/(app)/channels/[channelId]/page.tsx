import { ChannelHeader } from "@/components/channels/channel-header";
import { Composer } from "@/components/channels/composer";
import { JoinButton } from "@/components/channels/join-button";
import { MessageList } from "@/components/channels/message-list";
import { authorizeChannel } from "@/lib/dal";
import { canInChannel } from "@/lib/permissions";
import {
    listChannelMembers,
    listChannelMessages
} from "@/lib/queries/channels";
import { listApprovedUsers } from "@/lib/queries/users";
import { ScrollArea } from "@workspace/ui/components/scroll-area";

export default async function ChannelPage({
    params
}: {
    params: Promise<{ channelId: string }>;
}) {
    const { channelId } = await params;
    const { user, channel, membership } = await authorizeChannel(channelId, "channel:view");

    const canPost = canInChannel(user, membership, channel, "channel:post");
    const canManage = canInChannel(user, membership, channel, "channel:edit_settings");
    const canManageMembers = canInChannel(user, membership, channel, "channel:manage_members");
    const canJoin = !membership && !channel.isPrivate && !channel.isArchived;

    const [messages, memberRows, approvedUsers] = await Promise.all([
        listChannelMessages(channelId),
        listChannelMembers(channelId),
        canManageMembers ? listApprovedUsers() : Promise.resolve([])
    ]);

    const members = memberRows.map((m) => ({
        userId: m.userId,
        role: m.role,
        name: m.user.preferences?.displayName ?? m.user.name,
        colorHue: m.user.preferences?.colorHue ?? 220,
        avatarUrl: m.user.preferences?.avatarUrl ?? null
    }));

    const memberIds = new Set(memberRows.map((m) => m.userId));
    const addableUsers = approvedUsers.filter((u) => !memberIds.has(u.id));

    return (
        <div className="flex h-full min-h-0 flex-col">
            <ChannelHeader
                channel={channel}
                canManage={canManage}
                canManageMembers={canManageMembers}
                members={members}
                addableUsers={addableUsers}
            />

            <ScrollArea className="min-h-0 flex-1">
                <MessageList messages={messages} />
            </ScrollArea>

            {canPost ? (
                <Composer channelId={channel.id} channelName={channel.name} />
            ) : canJoin ? (
                <div className="flex items-center justify-between gap-3 border-t bg-background p-3">
                    <p className="text-sm text-muted-foreground">
                        Join this channel to send messages.
                    </p>
                    <JoinButton channelId={channel.id} />
                </div>
            ) : (
                <div className="border-t bg-background p-3 text-center text-sm text-muted-foreground">
                    {channel.isArchived
                        ? "This channel is archived."
                        : "You don't have permission to post here."}
                </div>
            )}
        </div>
    );
}
