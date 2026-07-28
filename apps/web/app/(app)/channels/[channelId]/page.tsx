import { Composer } from "@/components/channels/composer";
import { JoinButton } from "@/components/channels/join-button";
import { MarkReadOnView } from "@/components/channels/mark-read-on-view";
import { MessageHistory } from "@/components/channels/message-history";
import { MessageScroller } from "@/components/channels/message-scroller";
import type { MessageViewer } from "@/components/channels/message-toolbar";
import { OptimisticMessagesProvider } from "@/components/channels/optimistic-messages";
import { ThreadPanel } from "@/components/channels/thread-panel";
import { TypingIndicator } from "@/components/channels/typing-indicator";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { authorizeChannel } from "@/lib/dal";
import { canInChannel } from "@/lib/permissions";
import {
    CHANNEL_PAGE_SIZE,
    listChannelMembers,
    listChannelMessages,
    toChannelMembers
} from "@/lib/queries/channels";
import { cn } from "@workspace/ui/lib/utils";

import type { ComposerAuthor } from "@/components/channels/composer";

type SidebarMember = { userId: string; name: string; colorHue: number; avatarUrl: string | null };

/** The sending user's display identity for optimistic messages, derived from
 * their own channel-member row (falling back to the bare session user). */
function composerAuthorFor(
    userId: string,
    userName: string,
    members: SidebarMember[]
): ComposerAuthor {
    const self = members.find((m) => m.userId === userId);
    return {
        id: userId,
        name: self?.name ?? userName,
        colorHue: self?.colorHue ?? 220,
        avatarUrl: self?.avatarUrl ?? null
    };
}

export default async function ChannelPage({
    params,
    searchParams
}: {
    params: Promise<{ channelId: string }>;
    searchParams: Promise<{ thread?: string; profile?: string }>;
}) {
    const { channelId } = await params;
    const { thread: threadId, profile: profileId } = await searchParams;
    const { user, channel, membership } = await authorizeChannel(channelId, "channel:view");

    const canPost = canInChannel(user, membership, channel, "channel:post");
    const canJoin = !membership && !channel.isPrivate && !channel.isArchived;

    const viewer: MessageViewer = {
        userId: user.id,
        canPost,
        canManageMessages: canInChannel(user, membership, channel, "message:delete_any")
    };

    // listChannelMembers is request-memoized, so this shares the layout's read.
    const [messages, memberRows] = await Promise.all([
        listChannelMessages(channelId, user.id),
        listChannelMembers(channelId)
    ]);

    const members = toChannelMembers(memberRows);
    // Exclude yourself from the @-mention list.
    const composerMembers = members
        .filter((m) => m.userId !== user.id)
        .map((m) => ({ id: m.userId, name: m.name }));

    // Your display identity, used to render an optimistic message before the
    // server confirms it.
    const composerAuthor = composerAuthorFor(user.id, user.name, members);

    const latestMessageId = messages.length > 0 ? messages[messages.length - 1]!.id : null;

    const composerArea = canPost ? (
        <Composer
            channelId={channel.id}
            channelName={channel.name}
            members={composerMembers}
            author={composerAuthor}
        />
    ) : canJoin ? (
        <div className="flex items-center justify-between gap-3 border-t bg-background p-3">
            <p className="text-sm text-muted-foreground">Join this channel to send messages.</p>
            <JoinButton channelId={channel.id} />
        </div>
    ) : (
        <div className="border-t bg-background p-3 text-center text-sm text-muted-foreground">
            {channel.isArchived
                ? "This channel is archived."
                : "You don't have permission to post here."}
        </div>
    );

    return (
        <div data-component="ChannelPage" className="channel-text-scale flex h-full min-h-0">
            <div
                className={cn(
                    "flex min-h-0 min-w-0 flex-1 flex-col",
                    (threadId || profileId) && "hidden lg:flex"
                )}
            >
                {membership && (
                    <MarkReadOnView channelId={channel.id} latestMessageId={latestMessageId} />
                )}
                {/* The channel header is rendered by this segment's layout, so it
                    survives navigation between this view and the gallery. */}

                <OptimisticMessagesProvider>
                    <MessageScroller
                        bottomKey={`${latestMessageId}:${messages.length}`}
                        accentColor={channel.color}
                    >
                        <MessageHistory
                            channelId={channel.id}
                            initialMessages={messages}
                            initialHasMore={messages.length >= CHANNEL_PAGE_SIZE}
                            viewer={viewer}
                            members={composerMembers}
                        />
                    </MessageScroller>

                    <TypingIndicator channelId={channel.id} />

                    {composerArea}
                </OptimisticMessagesProvider>
            </div>

            {profileId ? (
                <ProfilePanel
                    userId={profileId}
                    viewerId={user.id}
                    closeHref={`/channels/${channel.id}`}
                />
            ) : threadId ? (
                <ThreadPanel
                    channelId={channel.id}
                    channelName={channel.name}
                    rootId={threadId}
                    viewer={viewer}
                    members={composerMembers}
                    canPost={canPost}
                />
            ) : null}
        </div>
    );
}
