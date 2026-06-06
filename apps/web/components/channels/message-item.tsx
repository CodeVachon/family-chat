"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { LinkCard } from "@/components/channels/link-card";
import { MessageAttachments } from "@/components/channels/message-attachments";
import { MessageBody } from "@/components/channels/message-body";
import { MessageToolbar, type MessageViewer } from "@/components/channels/message-toolbar";
import { ReactionBar } from "@/components/channels/reaction-bar";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import { editMessage } from "@/lib/actions/messages";
import { formatMessageTime } from "@/lib/format";
import type { ChannelMessage, ThreadMessage } from "@/lib/queries/channels";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";

type ItemMessage = ChannelMessage | ThreadMessage;

function InlineEditor({
    message,
    onDone
}: {
    message: ItemMessage;
    onDone: () => void;
}) {
    const router = useRouter();
    const [body, setBody] = useState(message.body);
    const [pending, setPending] = useState(false);

    async function save() {
        const trimmed = body.trim();
        if (!trimmed || pending) return;
        setPending(true);
        // Preserve existing mentions whose @Name is still present.
        const mentionUserIds = message.mentions
            .filter((m) => trimmed.includes(`@${m.name}`))
            .map((m) => m.userId);
        try {
            await editMessage({ messageId: message.id, body: trimmed, mentionUserIds });
            onDone();
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save");
            setPending(false);
        }
    }

    return (
        <div className="mt-1 flex flex-col gap-2">
            <Textarea
                value={body}
                autoFocus
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") onDone();
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void save();
                    }
                }}
                className="min-h-10"
            />
            <div className="flex gap-2">
                <Button size="sm" onClick={() => void save()} disabled={pending}>
                    Save
                </Button>
                <Button size="sm" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

export function MessageItem({
    message,
    viewer,
    showReply = true
}: {
    message: ItemMessage;
    viewer: MessageViewer;
    showReply?: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const prefs = message.author.preferences;
    const name = prefs?.displayName ?? message.author.name;
    const hue = prefs?.colorHue ?? 220;
    const deleted = Boolean(message.deletedAt);
    const replyCount = "replyCount" in message ? message.replyCount : 0;

    return (
        <div
            className={cn(
                "group relative flex gap-3 px-4 py-1.5 hover:bg-muted/30",
                message.mentionsMe && !deleted && "bg-amber-400/10"
            )}
        >
            <UserAvatar name={name} colorHue={hue} avatarUrl={prefs?.avatarUrl} className="mt-0.5 size-9" />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <UserName name={name} colorHue={hue} className="text-sm" />
                    <span className="text-xs text-muted-foreground">
                        {formatMessageTime(message.createdAt)}
                    </span>
                    {message.editedAt && !deleted && (
                        <span className="text-xs text-muted-foreground">(edited)</span>
                    )}
                </div>

                {deleted ? (
                    <p className="text-sm text-muted-foreground italic">This message was deleted.</p>
                ) : editing ? (
                    <InlineEditor message={message} onDone={() => setEditing(false)} />
                ) : (
                    <>
                        {message.body && <MessageBody body={message.body} mentions={message.mentions} />}
                        <MessageAttachments attachments={message.attachments} />
                        {message.linkPreviews.map((preview) => (
                            <LinkCard key={preview.id} preview={preview} />
                        ))}
                        <ReactionBar
                            messageId={message.id}
                            reactions={message.reactions}
                            canReact={viewer.canPost}
                        />
                        {showReply && replyCount > 0 && (
                            <Link
                                href={`?thread=${message.id}`}
                                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                                <MessageSquare className="size-3.5" />
                                {replyCount} {replyCount === 1 ? "reply" : "replies"}
                            </Link>
                        )}
                    </>
                )}
            </div>

            {!deleted && !editing && (
                <MessageToolbar
                    messageId={message.id}
                    authorUserId={message.authorUserId}
                    viewer={viewer}
                    showReply={showReply}
                    onStartEdit={() => setEditing(true)}
                />
            )}
        </div>
    );
}
