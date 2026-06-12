"use client";

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
    ComposerAttachment,
    type PendingAttachment
} from "@/components/channels/composer-attachment";
import {
    type OptimisticMessage,
    useOptimisticMessages
} from "@/components/channels/optimistic-messages";
import {
    RichTextEditor,
    type EditorState,
    type RichTextEditorHandle
} from "@/components/channels/rich-text-editor";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { postMessage } from "@/lib/actions/messages";
import { uploadToCloudinary } from "@/lib/cloudinary/upload-client";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

export type ComposerMember = { id: string; name: string };
/** The sending user's display identity, used to render the optimistic message. */
export type ComposerAuthor = {
    id: string;
    name: string;
    colorHue: number;
    avatarUrl: string | null;
};

const EMPTY_EDITOR: EditorState = { html: "", isEmpty: true, mentionIds: [] };

export function Composer({
    channelId,
    channelName,
    members,
    author,
    threadRootId = null,
    placeholder
}: {
    channelId: string;
    channelName: string;
    members: ComposerMember[];
    author?: ComposerAuthor;
    threadRootId?: string | null;
    placeholder?: string;
}) {
    const router = useRouter();
    const optimistic = useOptimisticMessages();
    const { sendTyping } = useRealtime();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<RichTextEditorHandle>(null);
    const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
    const [pending, setPending] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [items, setItems] = useState<PendingAttachment[]>([]);

    const update = (id: string, patch: Partial<PendingAttachment>) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

    function startUpload(file: File) {
        const id = crypto.randomUUID();
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        setItems((prev) => [
            ...prev,
            { id, name: file.name, previewUrl, status: "uploading", progress: 0 }
        ]);
        uploadToCloudinary(file, (pct) => update(id, { progress: pct }))
            .then((data) => update(id, { status: "done", progress: 100, data }))
            .catch((err) => {
                update(id, { status: "error" });
                toast.error(err instanceof Error ? err.message : "Upload failed");
            });
    }

    function addFiles(files: FileList | File[]) {
        const list = Array.from(files);
        if (items.length + list.length > 10) {
            toast.error("Up to 10 attachments per message");
            return;
        }
        list.forEach(startUpload);
    }

    function removeItem(id: string) {
        setItems((prev) => {
            const target = prev.find((it) => it.id === id);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((it) => it.id !== id);
        });
    }

    const anyUploading = items.some((it) => it.status === "uploading");
    const readyAttachments = items
        .filter((it) => it.status === "done" && it.data)
        .map((it) => it.data!);
    const canSend = !pending && !anyUploading && (!editor.isEmpty || readyAttachments.length > 0);

    // Build the optimistic message shown in the timeline the instant we send,
    // before the server round-trip. Reconciled against the persisted row (by
    // the returned id) once router.refresh() refetches the list.
    function buildOptimistic(
        nonce: string,
        html: string,
        mentionIds: string[],
        attachmentsInput: typeof readyAttachments
    ): OptimisticMessage {
        const id = `optimistic:${nonce}`;
        const now = new Date();
        return {
            id,
            channelId,
            authorUserId: author!.id,
            type: "user",
            systemEvent: null,
            threadRootId,
            body: html,
            editedAt: null,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            author: {
                id: author!.id,
                name: author!.name,
                preferences: {
                    displayName: author!.name,
                    colorHue: author!.colorHue,
                    avatarUrl: author!.avatarUrl
                }
            },
            attachments: attachmentsInput.map((a, i) => ({
                id: `${id}:${i}`,
                messageId: id,
                uploaderId: author!.id,
                kind: a.kind,
                provider: "cloudinary",
                publicId: a.publicId,
                resourceType: a.resourceType,
                secureUrl: a.secureUrl,
                format: a.format,
                bytes: a.bytes,
                width: a.width,
                height: a.height,
                originalFilename: a.originalFilename,
                thumbnailUrl: null,
                createdAt: now
            })),
            reactions: [],
            mentions: mentionIds.map((uid) => ({
                userId: uid,
                name: members.find((m) => m.id === uid)?.name ?? "",
                colorHue: 220
            })),
            mentionsMe: false,
            linkPreviews: [],
            replyCount: 0,
            lastReplyAt: null,
            pending: true,
            nonce
        };
    }

    function send() {
        if (!canSend) return;

        // Snapshot the current draft so we can restore it if the send fails.
        const html = editor.html;
        const wasEmpty = editor.isEmpty;
        const mentionIds = editor.mentionIds;
        const sentItems = items;
        const attachmentsInput = readyAttachments;

        const optimisticEnabled = Boolean(optimistic && author);
        const nonce = crypto.randomUUID();

        // Clear the composer immediately so sending feels instant.
        editorRef.current?.clear();
        setEditor(EMPTY_EDITOR);
        setItems([]);
        if (optimisticEnabled) {
            optimistic!.enqueue(buildOptimistic(nonce, html, mentionIds, attachmentsInput));
        } else {
            setPending(true);
        }

        void (async () => {
            try {
                const res = await postMessage({
                    channelId,
                    threadRootId,
                    body: html,
                    attachments: attachmentsInput,
                    mentionUserIds: mentionIds
                });
                sentItems.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
                if (optimisticEnabled && res) {
                    optimistic!.resolve(nonce, {
                        realId: res.id,
                        createdAt: new Date(res.createdAt)
                    });
                }
                router.refresh();
            } catch (err) {
                // Roll back: drop the optimistic message and restore the draft.
                if (optimisticEnabled) optimistic!.fail(nonce);
                editorRef.current?.setContent(html);
                setEditor({ html, isEmpty: wasEmpty, mentionIds });
                setItems(sentItems);
                toast.error(err instanceof Error ? err.message : "Failed to send message");
            } finally {
                if (!optimisticEnabled) setPending(false);
            }
        })();
    }

    return (
        <div
            data-component="Composer"
            className={cn(
                "relative border-t bg-background",
                dragOver && "bg-muted/50 ring-2 ring-ring ring-inset"
            )}
            onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
            onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length > 0) {
                    e.preventDefault();
                    addFiles(files);
                }
            }}
        >
            {items.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {items.map((it) => (
                        <ComposerAttachment key={it.id} item={it} onRemove={removeItem} />
                    ))}
                </div>
            )}

            <RichTextEditor
                ref={editorRef}
                members={members}
                placeholder={placeholder ?? `Message #${channelName}`}
                onChange={setEditor}
                onSubmit={() => void send()}
                onTyping={() => sendTyping(channelId)}
            />

            <div className="flex items-center justify-between gap-2 p-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) addFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Attach files"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Paperclip className="size-4" />
                </Button>
                <Button onClick={() => void send()} disabled={!canSend}>
                    Send
                </Button>
            </div>
        </div>
    );
}
