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

const EMPTY_EDITOR: EditorState = { html: "", isEmpty: true, mentionIds: [] };

export function Composer({
    channelId,
    channelName,
    members,
    threadRootId = null,
    placeholder
}: {
    channelId: string;
    channelName: string;
    members: ComposerMember[];
    threadRootId?: string | null;
    placeholder?: string;
}) {
    const router = useRouter();
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

    async function send() {
        if (!canSend) return;
        setPending(true);
        try {
            await postMessage({
                channelId,
                threadRootId,
                body: editor.html,
                attachments: readyAttachments,
                mentionUserIds: editor.mentionIds
            });
            items.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
            editorRef.current?.clear();
            setEditor(EMPTY_EDITOR);
            setItems([]);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send message");
        } finally {
            setPending(false);
        }
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
