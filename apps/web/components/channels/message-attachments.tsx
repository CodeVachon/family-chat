import { AttachmentActions } from "@/components/channels/attachment-actions";
import { AttachmentCard } from "@/components/channels/attachment-card";
import { ImageGallery } from "@/components/channels/image-gallery";
import { PdfAttachment } from "@/components/channels/pdf-attachment";
import type { ChannelAttachment } from "@/lib/queries/channels";

export function MessageAttachments({
    attachments,
    canPost
}: {
    attachments: ChannelAttachment[];
    canPost: boolean;
}) {
    if (attachments.length === 0) return null;

    const images = attachments.filter((a) => a.kind === "image");
    const pdfs = attachments.filter((a) => a.kind === "pdf");
    const files = attachments.filter((a) => a.kind !== "image" && a.kind !== "pdf");

    return (
        <div data-component="MessageAttachments" className="flex flex-col gap-2">
            {images.length > 0 && (
                <ImageGallery images={images.map((a) => ({ id: a.id, secureUrl: a.secureUrl }))} />
            )}
            {/* Documents (PDFs/files) carry per-attachment like + comment controls. */}
            {pdfs.map((a) => (
                <div key={a.id} className="flex flex-col gap-1">
                    <PdfAttachment
                        attachment={{
                            id: a.id,
                            secureUrl: a.secureUrl,
                            resourceType: a.resourceType,
                            originalFilename: a.originalFilename,
                            bytes: a.bytes
                        }}
                    />
                    <AttachmentActions attachment={a} canPost={canPost} />
                </div>
            ))}
            {files.map((a) => (
                <div key={a.id} className="flex flex-col gap-1">
                    <AttachmentCard
                        attachment={{
                            id: a.id,
                            kind: a.kind,
                            secureUrl: a.secureUrl,
                            originalFilename: a.originalFilename,
                            format: a.format,
                            bytes: a.bytes
                        }}
                    />
                    <AttachmentActions attachment={a} canPost={canPost} />
                </div>
            ))}
        </div>
    );
}
