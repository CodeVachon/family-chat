"use client";

import { Heart, MessageSquare, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Timestamp } from "@/components/preferences/user-prefs";
import { UserName } from "@/components/user/user-identity";
import {
    addAttachmentComment,
    deleteAttachmentComment,
    listAttachmentComments,
    toggleAttachmentLike,
    type AttachmentCommentView
} from "@/lib/actions/attachments";
import type { ChannelAttachment } from "@/lib/queries/channels";
import { cn } from "@workspace/ui/lib/utils";

/** Like + comment controls shown beneath an uploaded document. Comments load
 * on demand when the thread is expanded. */
export function AttachmentActions({
    attachment,
    canPost
}: {
    attachment: ChannelAttachment;
    canPost: boolean;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [comments, setComments] = useState<AttachmentCommentView[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);

    async function loadComments() {
        setLoading(true);
        try {
            setComments(await listAttachmentComments(attachment.id));
        } catch {
            toast.error("Couldn't load comments");
        } finally {
            setLoading(false);
        }
    }

    async function like() {
        if (!canPost) return;
        try {
            await toggleAttachmentLike(attachment.id);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't update like");
        }
    }

    function toggleComments() {
        const next = !open;
        setOpen(next);
        if (next && comments === null) void loadComments();
    }

    async function submitComment(e: React.FormEvent) {
        e.preventDefault();
        const body = draft.trim();
        if (!body || busy) return;
        setBusy(true);
        try {
            await addAttachmentComment(attachment.id, body);
            setDraft("");
            await loadComments();
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't post comment");
        } finally {
            setBusy(false);
        }
    }

    async function removeComment(id: string) {
        try {
            await deleteAttachmentComment(id);
            await loadComments();
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't delete comment");
        }
    }

    return (
        <div data-component="AttachmentActions" className="flex max-w-md flex-col gap-1.5">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <button
                    type="button"
                    disabled={!canPost}
                    onClick={() => void like()}
                    className={cn(
                        "inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted",
                        !canPost && "cursor-default hover:bg-transparent"
                    )}
                    aria-pressed={attachment.likedByMe}
                    title={attachment.likedByMe ? "Unlike" : "Like"}
                >
                    <Heart
                        className={cn(
                            "size-3.5",
                            attachment.likedByMe && "fill-red-500 text-red-500"
                        )}
                    />
                    {attachment.likeCount > 0 && (
                        <span className="tabular-nums">{attachment.likeCount}</span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={toggleComments}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted"
                >
                    <MessageSquare className="size-3.5" />
                    <span className="tabular-nums">
                        {attachment.commentCount > 0 ? attachment.commentCount : "Comment"}
                    </span>
                </button>
            </div>

            {open && (
                <div className="flex flex-col gap-2 rounded-lg border bg-card p-2">
                    {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
                    {!loading && comments?.length === 0 && (
                        <p className="text-xs text-muted-foreground">No comments yet.</p>
                    )}
                    {comments?.map((c) => (
                        <div key={c.id} className="group/comment flex flex-col gap-0.5 text-sm">
                            <div className="flex items-center gap-1.5">
                                <UserName
                                    name={c.authorName}
                                    colorHue={c.authorColorHue}
                                    className="text-xs"
                                />
                                <Timestamp
                                    date={c.createdAt}
                                    className="text-xs text-muted-foreground/70"
                                />
                                {c.canDelete && (
                                    <button
                                        type="button"
                                        onClick={() => void removeComment(c.id)}
                                        className="ml-auto text-muted-foreground opacity-0 transition-opacity group-hover/comment:opacity-100"
                                        aria-label="Delete comment"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                )}
                            </div>
                            <p className="break-words whitespace-pre-wrap">{c.body}</p>
                        </div>
                    ))}
                    {canPost && (
                        <form onSubmit={submitComment} className="flex items-center gap-2">
                            <input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Add a comment…"
                                maxLength={2000}
                                className="h-8 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring"
                            />
                            <button
                                type="submit"
                                disabled={busy || draft.trim().length === 0}
                                className="h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                            >
                                Post
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
