"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { ComposerMember } from "@/components/channels/composer";
import { LinkCard } from "@/components/channels/link-card";
import { MessageAttachments } from "@/components/channels/message-attachments";
import { MessageBody } from "@/components/channels/message-body";
import { MessageToolbar, type MessageViewer } from "@/components/channels/message-toolbar";
import { ReactionBar } from "@/components/channels/reaction-bar";
import { RichTextEditor, type EditorState } from "@/components/channels/rich-text-editor";
import { Timestamp } from "@/components/preferences/user-prefs";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import { editMessage } from "@/lib/actions/messages";
import { htmlToText, isHtmlBody, plainTextToHtml } from "@/lib/messaging/rich-text";
import type { ChannelMessage, ThreadMessage } from "@/lib/queries/channels";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

type ItemMessage = ChannelMessage | ThreadMessage;

function InlineEditor({
    message,
    members,
    onDone
}: {
    message: ItemMessage;
    members: ComposerMember[];
    onDone: () => void;
}) {
    const router = useRouter();
    const initialHtml = isHtmlBody(message.body) ? message.body : plainTextToHtml(message.body);
    const [editor, setEditor] = useState<EditorState>({
        html: message.body,
        isEmpty: htmlToText(message.body).length === 0,
        mentionIds: []
    });
    const [pending, setPending] = useState(false);

    async function save() {
        if (editor.isEmpty || pending) return;
        setPending(true);
        // Mentions from editor nodes, plus any legacy @Name still present as text.
        const text = htmlToText(editor.html);
        const mentionUserIds = [
            ...new Set([
                ...editor.mentionIds,
                ...message.mentions.filter((m) => text.includes(`@${m.name}`)).map((m) => m.userId)
            ])
        ];
        try {
            await editMessage({ messageId: message.id, body: editor.html, mentionUserIds });
            onDone();
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save");
            setPending(false);
        }
    }

    return (
        <div data-component="InlineEditor" className="mt-1 flex flex-col gap-2">
            <RichTextEditor
                members={members}
                autoFocus
                initialHtml={initialHtml}
                onChange={setEditor}
                onSubmit={() => void save()}
            />
            <div className="flex gap-2">
                <Button size="sm" onClick={() => void save()} disabled={pending || editor.isEmpty}>
                    Save
                </Button>
                <Button size="sm" variant="ghost" onClick={onDone}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

/** The body of a live (non-deleted, non-editing) message: text, attachments,
 * link previews, reactions, and the reply affordance. */
function MessageContent({
    message,
    canReact,
    showReply,
    replyCount,
    pending
}: {
    message: ItemMessage;
    canReact: boolean;
    showReply: boolean;
    replyCount: number;
    pending: boolean;
}) {
    return (
        <div data-component="MessageContent">
            {message.body && <MessageBody body={message.body} mentions={message.mentions} />}
            <MessageAttachments attachments={message.attachments} />
            {message.linkPreviews.length > 0 && (
                <div className="my-1.5 flex flex-col gap-2">
                    {message.linkPreviews.map((preview) => (
                        <LinkCard key={preview.id} preview={preview} />
                    ))}
                </div>
            )}
            {!pending && (
                <ReactionBar
                    messageId={message.id}
                    reactions={message.reactions}
                    canReact={canReact}
                />
            )}
            {showReply && replyCount > 0 && (
                <Link
                    href={`?thread=${message.id}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                    <MessageSquare className="size-3.5" />
                    {replyCount} {replyCount === 1 ? "reply" : "replies"}
                </Link>
            )}
        </div>
    );
}

export function MessageItem({
    message,
    viewer,
    members = [],
    showReply = true,
    pending = false
}: {
    message: ItemMessage;
    viewer: MessageViewer;
    members?: ComposerMember[];
    showReply?: boolean;
    /** Optimistically rendered, not yet confirmed by the server. */
    pending?: boolean;
}) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const prefs = message.author.preferences;
    const name = prefs?.displayName ?? message.author.name;
    const hue = prefs?.colorHue ?? 220;
    const deleted = Boolean(message.deletedAt);
    const replyCount = "replyCount" in message ? message.replyCount : 0;
    // In the channel list (not a thread), a tap on touch devices opens the
    // message's thread — the thread view is where the actions menu lives.
    const inThread = !showReply;

    function handleTouchTap(e: React.MouseEvent) {
        if (pending || inThread || editing || deleted) return;
        if (!window.matchMedia("(hover: none)").matches) return;
        const target = e.target as HTMLElement;
        if (target.closest("a, button, [role='button'], input, textarea, [contenteditable='true']"))
            return;
        router.push(`?thread=${message.id}`);
    }

    return (
        <div
            data-component="MessageItem"
            onClick={handleTouchTap}
            className={cn(
                "group relative flex gap-3 px-4 py-1.5 hover:bg-muted/30",
                message.mentionsMe && !deleted && "bg-amber-400/10",
                pending && "opacity-60"
            )}
        >
            <Link href={`?profile=${message.authorUserId}`} className="mt-0.5 shrink-0">
                <UserAvatar
                    name={name}
                    colorHue={hue}
                    avatarUrl={prefs?.avatarUrl}
                    className="size-9"
                />
            </Link>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <Link
                        href={`?profile=${message.authorUserId}`}
                        className="rounded-sm hover:underline"
                    >
                        <UserName name={name} colorHue={hue} className="text-sm" />
                    </Link>
                    {pending ? (
                        <span className="text-xs text-muted-foreground">Sending…</span>
                    ) : (
                        <Timestamp
                            date={message.createdAt}
                            className="text-xs text-muted-foreground"
                        />
                    )}
                    {message.editedAt && !deleted && (
                        <span className="text-xs text-muted-foreground">(edited)</span>
                    )}
                </div>

                {deleted ? (
                    <p className="text-sm text-muted-foreground italic">
                        This message was deleted.
                    </p>
                ) : editing ? (
                    <InlineEditor
                        message={message}
                        members={members}
                        onDone={() => setEditing(false)}
                    />
                ) : (
                    <MessageContent
                        message={message}
                        canReact={viewer.canPost}
                        showReply={showReply}
                        replyCount={replyCount}
                        pending={pending}
                    />
                )}
            </div>

            {!deleted && !editing && !pending && (
                <MessageToolbar
                    messageId={message.id}
                    authorUserId={message.authorUserId}
                    viewer={viewer}
                    showReply={showReply}
                    showTouchMenu={inThread}
                    onStartEdit={() => setEditing(true)}
                />
            )}
        </div>
    );
}
