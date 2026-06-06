"use client";

import { FileText, Loader2, X } from "lucide-react";

import type { AttachmentInput } from "@/lib/validation/channel";

export type PendingAttachment = {
    id: string;
    name: string;
    previewUrl?: string;
    status: "uploading" | "done" | "error";
    progress: number;
    data?: AttachmentInput;
};

export function ComposerAttachment({
    item,
    onRemove
}: {
    item: PendingAttachment;
    onRemove: (id: string) => void;
}) {
    const isImage = Boolean(item.previewUrl);

    return (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt={item.name} className="size-full object-cover" />
            ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 p-1 text-center">
                    <FileText className="size-5 text-muted-foreground" />
                    <span className="line-clamp-1 text-[10px] text-muted-foreground">{item.name}</span>
                </div>
            )}

            {item.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
                    <Loader2 className="mr-1 size-3 animate-spin" />
                    {item.progress}%
                </div>
            )}
            {item.status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/70 text-[10px] font-medium text-white">
                    Failed
                </div>
            )}

            <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => onRemove(item.id)}
                className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
                <X className="size-3" />
            </button>
        </div>
    );
}
