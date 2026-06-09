import { FileText } from "lucide-react";

import { formatBytes } from "@/lib/format";

export type FileAttachment = {
    id: string;
    kind: string;
    secureUrl: string;
    originalFilename: string | null;
    format: string | null;
    bytes: number | null;
};

export function AttachmentCard({ attachment }: { attachment: FileAttachment }) {
    const name =
        attachment.originalFilename ??
        (attachment.format ? `file.${attachment.format}` : "attachment");
    const label = attachment.kind === "pdf" ? "PDF" : attachment.format?.toUpperCase();
    const meta = [label, formatBytes(attachment.bytes)].filter(Boolean).join(" · ");

    return (
        <a
            data-component="AttachmentCard"
            href={attachment.secureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-72 max-w-full items-center gap-3 rounded-lg border bg-card p-2 transition-colors hover:bg-muted/50"
        >
            <div className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
                <FileText className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
            </div>
        </a>
    );
}
