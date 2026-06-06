"use client";

import { MessageSquare, Pencil, SmilePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteMessage } from "@/lib/actions/messages";
import { toggleReaction } from "@/lib/actions/reactions";
import { REACTION_EMOJIS } from "@/lib/validation/channel";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";

export type MessageViewer = {
    userId: string;
    canPost: boolean;
    canManageMessages: boolean;
};

export function MessageToolbar({
    messageId,
    authorUserId,
    viewer,
    showReply,
    onStartEdit
}: {
    messageId: string;
    authorUserId: string;
    viewer: MessageViewer;
    showReply: boolean;
    onStartEdit: () => void;
}) {
    const router = useRouter();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const isAuthor = authorUserId === viewer.userId;
    const canEdit = (isAuthor && viewer.canPost) || viewer.canManageMessages;
    const canDelete = isAuthor || viewer.canManageMessages;

    async function react(emoji: string) {
        setPickerOpen(false);
        try {
            await toggleReaction(messageId, emoji);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't react");
        }
    }

    async function remove() {
        try {
            await deleteMessage(messageId);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't delete");
        }
    }

    const btn =
        "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";

    return (
        <div
            className={cn(
                "absolute -top-3 right-3 items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-sm",
                // Stay laid out while the picker/confirm is open so its anchor
                // doesn't collapse (which caused the popover to flicker).
                pickerOpen || confirmOpen ? "flex" : "hidden group-hover:flex"
            )}
        >
            {viewer.canPost && (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger className={btn} aria-label="Add reaction">
                        <SmilePlus className="size-4" />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1">
                        <div className="flex gap-1">
                            {REACTION_EMOJIS.map((e) => (
                                <button
                                    key={e}
                                    type="button"
                                    onClick={() => react(e)}
                                    className="rounded p-1 text-lg hover:bg-muted"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
            {showReply && (
                <Link href={`?thread=${messageId}`} className={btn} aria-label="Reply in thread">
                    <MessageSquare className="size-4" />
                </Link>
            )}
            {canEdit && (
                <button type="button" onClick={onStartEdit} className={btn} aria-label="Edit">
                    <Pencil className="size-4" />
                </button>
            )}
            {canDelete && (
                <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    className={btn}
                    aria-label="Delete"
                >
                    <Trash2 className="size-4" />
                </button>
            )}

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Delete message?"
                description="This message will be removed for everyone. This can't be undone."
                confirmLabel="Delete"
                destructive
                onConfirm={remove}
            />
        </div>
    );
}
