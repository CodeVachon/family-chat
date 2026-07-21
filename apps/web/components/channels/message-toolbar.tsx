"use client";

import { MessageSquare, MoreHorizontal, Pencil, SmilePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteMessage } from "@/lib/actions/messages";
import { toggleReaction } from "@/lib/actions/reactions";
import { REACTION_EMOJIS } from "@/lib/validation/channel";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@workspace/ui/components/dropdown-menu";
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
    showTouchMenu,
    onStartEdit
}: {
    messageId: string;
    authorUserId: string;
    viewer: MessageViewer;
    showReply: boolean;
    /** Show the tap-accessible kebab menu on touch devices (thread view only;
     *  in the channel list, tapping a message opens its thread instead). */
    showTouchMenu: boolean;
    onStartEdit: () => void;
}) {
    const router = useRouter();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const isAuthor = authorUserId === viewer.userId;
    // Editing is author-only; admins can still delete via canManageMessages.
    const canEdit = isAuthor && viewer.canPost;
    const canDelete = isAuthor || viewer.canManageMessages;

    async function react(emoji: string) {
        setPickerOpen(false);
        setMenuOpen(false);
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
            data-component="MessageToolbar"
            className="absolute -top-3 right-3 flex items-center gap-1"
        >
            {/* Pointer devices: floating bar revealed on hover. */}
            <div
                className={cn(
                    "items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-sm",
                    // Touch devices use the kebab menu below instead.
                    "[@media(hover:none)]:hidden",
                    // Stay laid out while a popup is open so its anchor doesn't
                    // collapse (which caused the popover to flicker).
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
                    <Link
                        href={`?thread=${messageId}`}
                        className={btn}
                        aria-label="Reply in thread"
                    >
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
            </div>

            {/* Touch devices (thread view): kebab opening an actions menu. */}
            <div className={cn("hidden", showTouchMenu && "[@media(hover:none)]:block")}>
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger
                        className="flex size-7 items-center justify-center rounded-md border bg-popover text-muted-foreground shadow-sm"
                        aria-label="Message actions"
                    >
                        <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {viewer.canPost && (
                            <>
                                <div className="flex flex-wrap gap-1 p-1">
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
                                {(showReply || canEdit || canDelete) && <DropdownMenuSeparator />}
                            </>
                        )}
                        {showReply && (
                            <DropdownMenuItem render={<Link href={`?thread=${messageId}`} />}>
                                <MessageSquare className="size-4" />
                                Reply in thread
                            </DropdownMenuItem>
                        )}
                        {canEdit && (
                            <DropdownMenuItem onClick={onStartEdit}>
                                <Pencil className="size-4" />
                                Edit
                            </DropdownMenuItem>
                        )}
                        {canDelete && (
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setConfirmOpen(true)}
                            >
                                <Trash2 className="size-4" />
                                Delete
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

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
