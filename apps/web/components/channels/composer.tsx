"use client";

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ComposerAttachment, type PendingAttachment } from "@/components/channels/composer-attachment";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { postMessage } from "@/lib/actions/messages";
import { uploadToCloudinary } from "@/lib/cloudinary/upload-client";
import { applyMention, getMentionQuery, type MentionQuery } from "@/lib/messaging/mention-input";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";

export type ComposerMember = { id: string; name: string };

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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mentioned = useRef<Set<string>>(new Set());
    const [body, setBody] = useState("");
    const [pending, setPending] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [items, setItems] = useState<PendingAttachment[]>([]);
    const [mention, setMention] = useState<MentionQuery | null>(null);
    const [highlight, setHighlight] = useState(0);

    const matches = mention
        ? members
              .filter((m) => m.name.toLowerCase().includes(mention.query.toLowerCase()))
              .slice(0, 6)
        : [];

    const update = (id: string, patch: Partial<PendingAttachment>) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

    function startUpload(file: File) {
        const id = crypto.randomUUID();
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        setItems((prev) => [...prev, { id, name: file.name, previewUrl, status: "uploading", progress: 0 }]);
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

    function syncMention(value: string, caret: number) {
        setMention(getMentionQuery(value, caret));
        setHighlight(0);
    }

    function selectMember(member: ComposerMember) {
        if (!mention) return;
        const caret = textareaRef.current?.selectionStart ?? body.length;
        const next = applyMention(body, mention.start, caret, member.name);
        mentioned.current.add(member.id);
        setBody(next.text);
        setMention(null);
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (el) {
                el.focus();
                el.setSelectionRange(next.caret, next.caret);
            }
        });
    }

    const anyUploading = items.some((it) => it.status === "uploading");
    const readyAttachments = items.filter((it) => it.status === "done" && it.data).map((it) => it.data!);
    const canSend = !pending && !anyUploading && (body.trim().length > 0 || readyAttachments.length > 0);

    async function send() {
        if (!canSend) return;
        setPending(true);
        const mentionUserIds = members
            .filter((m) => mentioned.current.has(m.id) && body.includes(`@${m.name}`))
            .map((m) => m.id);
        try {
            await postMessage({
                channelId,
                threadRootId,
                body: body.trim(),
                attachments: readyAttachments,
                mentionUserIds
            });
            items.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
            setBody("");
            setItems([]);
            mentioned.current.clear();
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send message");
        } finally {
            setPending(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (matches.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % matches.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h - 1 + matches.length) % matches.length);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                selectMember(matches[highlight]!);
                return;
            }
            if (e.key === "Escape") {
                setMention(null);
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
    }

    return (
        <div
            className={cn("relative border-t bg-background p-3", dragOver && "bg-muted/50 ring-2 ring-ring ring-inset")}
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
        >
            {matches.length > 0 && (
                <div className="absolute bottom-full left-3 z-10 mb-1 w-56 overflow-hidden rounded-lg border bg-popover shadow-md">
                    {matches.map((m, i) => (
                        <button
                            key={m.id}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                selectMember(m);
                            }}
                            className={cn(
                                "block w-full px-3 py-1.5 text-left text-sm",
                                i === highlight ? "bg-muted" : "hover:bg-muted/60"
                            )}
                        >
                            @{m.name}
                        </button>
                    ))}
                </div>
            )}

            {items.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {items.map((it) => (
                        <ComposerAttachment key={it.id} item={it} onRemove={removeItem} />
                    ))}
                </div>
            )}

            <div className="flex items-end gap-2">
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
                <Textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => {
                        setBody(e.target.value);
                        syncMention(e.target.value, e.target.selectionStart);
                        if (e.target.value.trim().length > 0) sendTyping(channelId);
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={(e) => {
                        const files = Array.from(e.clipboardData.files);
                        if (files.length > 0) addFiles(files);
                    }}
                    placeholder={placeholder ?? `Message #${channelName}`}
                    rows={1}
                    className="max-h-40 min-h-10 resize-none"
                />
                <Button onClick={() => void send()} disabled={!canSend}>
                    Send
                </Button>
            </div>
        </div>
    );
}
