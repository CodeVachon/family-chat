import { ChannelHeader } from "@/components/channels/channel-header";
import { Composer } from "@/components/channels/composer";
import { JoinButton } from "@/components/channels/join-button";
import { MarkReadOnView } from "@/components/channels/mark-read-on-view";
import { MessageList } from "@/components/channels/message-list";
import { MessageScroller } from "@/components/channels/message-scroller";
import type { MessageViewer } from "@/components/channels/message-toolbar";
import { ThreadPanel } from "@/components/channels/thread-panel";
import { TypingIndicator } from "@/components/channels/typing-indicator";
import { authorizeChannel } from "@/lib/dal";
import { canInChannel } from "@/lib/permissions";
import { listChannelMembers, listChannelMessages } from "@/lib/queries/channels";
import { listApprovedUsers } from "@/lib/queries/users";
import { cn } from "@workspace/ui/lib/utils";

export default async function ChannelPage({
    params,
    searchParams
}: {
    params: Promise<{ channelId: string }>;
    searchParams: Promise<{ thread?: string }>;
}) {
    const { channelId } = await params;
    const { thread: threadId } = await searchParams;
    const { user, channel, membership } = await authorizeChannel(channelId, "channel:view");

    const canPost = canInChannel(user, membership, channel, "channel:post");
    const canManage = canInChannel(user, membership, channel, "channel:edit_settings");
    const canManageMembers = canInChannel(user, membership, channel, "channel:manage_members");
    const canJoin = !membership && !channel.isPrivate && !channel.isArchived;

    const viewer: MessageViewer = {
        userId: user.id,
        canPost,
        canManageMessages: canInChannel(user, membership, channel, "message:delete_any")
    };

    const [messages, memberRows, approvedUsers] = await Promise.all([
        listChannelMessages(channelId, user.id),
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
    // Exclude yourself from the @-mention list.
    const composerMembers = members
        .filter((m) => m.userId !== user.id)
        .map((m) => ({ id: m.userId, name: m.name }));

    const memberIds = new Set(memberRows.map((m) => m.userId));
    const addableUsers = approvedUsers.filter((u) => !memberIds.has(u.id));

    const latestMessageId = messages.length > 0 ? messages[messages.length - 1]!.id : null;

    return (
        <div className="flex h-full min-h-0">
            <div className={cn("flex min-h-0 flex-1 flex-col", threadId && "hidden lg:flex")}>
                {membership && (
                    <MarkReadOnView channelId={channel.id} latestMessageId={latestMessageId} />
                )}
                <ChannelHeader
                    channel={channel}
                    canManage={canManage}
                    canManageMembers={canManageMembers}
                    members={members}
                    addableUsers={addableUsers}
                />

                <MessageScroller bottomKey={`${latestMessageId}:${messages.length}`}>
                    <MessageList messages={messages} viewer={viewer} members={composerMembers} />
                </MessageScroller>

                <TypingIndicator channelId={channel.id} />

                {canPost ? (
                    <Composer
                        channelId={channel.id}
                        channelName={channel.name}
                        members={composerMembers}
                    />
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

            {threadId && (
                <ThreadPanel
                    channelId={channel.id}
                    channelName={channel.name}
                    rootId={threadId}
                    viewer={viewer}
                    members={composerMembers}
                    canPost={canPost}
                />
            )}
        </div>
    );
}
