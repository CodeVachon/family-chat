import { X } from "lucide-react";
import Link from "next/link";

import { Composer, type ComposerMember } from "@/components/channels/composer";
import { MessageItem } from "@/components/channels/message-item";
import { MessageScroller } from "@/components/channels/message-scroller";
import type { MessageViewer } from "@/components/channels/message-toolbar";
import { listThreadMessages } from "@/lib/queries/channels";

export async function ThreadPanel({
    channelId,
    channelName,
    rootId,
    viewer,
    members,
    canPost
}: {
    channelId: string;
    channelName: string;
    rootId: string;
    viewer: MessageViewer;
    members: ComposerMember[];
    canPost: boolean;
}) {
    const messages = await listThreadMessages(rootId, viewer.userId);
    const root = messages[0];
    const valid = root && root.channelId === channelId && !root.threadRootId;

    return (
        <aside
            data-component="ThreadPanel"
            className="flex h-full min-h-0 w-full flex-col border-l bg-background lg:w-96"
        >
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                <h2 className="font-heading text-base font-semibold">Thread</h2>
                <Link
                    href={`/channels/${channelId}`}
                    aria-label="Close thread"
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                    <X className="size-4" />
                </Link>
            </header>

            {!valid ? (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                    This thread is no longer available.
                </div>
            ) : (
                <>
                    <MessageScroller bottomKey={`${messages[messages.length - 1]?.id}:${messages.length}`}>
                        <div className="py-4">
                            {messages.map((m) => (
                                <MessageItem
                                    key={m.id}
                                    message={m}
                                    viewer={viewer}
                                    members={members}
                                    showReply={false}
                                />
                            ))}
                        </div>
                    </MessageScroller>
                    {canPost ? (
                        <Composer
                            channelId={channelId}
                            channelName={channelName}
                            members={members}
                            threadRootId={rootId}
                            placeholder="Reply…"
                        />
                    ) : (
                        <div className="border-t p-3 text-center text-sm text-muted-foreground">
                            You don&apos;t have permission to reply here.
                        </div>
                    )}
                </>
            )}
        </aside>
    );
}
