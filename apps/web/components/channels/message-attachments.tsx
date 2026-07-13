import { AttachmentCard } from "@/components/channels/attachment-card";
import { ImageGallery } from "@/components/channels/image-gallery";
import { PdfAttachment } from "@/components/channels/pdf-attachment";
import { VideoAttachment } from "@/components/channels/video-attachment";
import type { Attachment } from "@workspace/db/schema";

export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
    if (attachments.length === 0) return null;

    const images = attachments.filter((a) => a.kind === "image");
    const videos = attachments.filter((a) => a.kind === "video");
    const pdfs = attachments.filter((a) => a.kind === "pdf");
    const files = attachments.filter(
        (a) => a.kind !== "image" && a.kind !== "pdf" && a.kind !== "video"
    );

    return (
        <div data-component="MessageAttachments" className="flex flex-col gap-2">
            {images.length > 0 && (
                <ImageGallery images={images.map((a) => ({ id: a.id, secureUrl: a.secureUrl }))} />
            )}
            {videos.map((a) => (
                <VideoAttachment
                    key={a.id}
                    attachment={{
                        id: a.id,
                        secureUrl: a.secureUrl,
                        width: a.width,
                        height: a.height
                    }}
                />
            ))}
            {pdfs.map((a) => (
                <PdfAttachment
                    key={a.id}
                    attachment={{
                        id: a.id,
                        secureUrl: a.secureUrl,
                        resourceType: a.resourceType,
                        originalFilename: a.originalFilename,
                        bytes: a.bytes
                    }}
                />
            ))}
            {files.map((a) => (
                <AttachmentCard
                    key={a.id}
                    attachment={{
                        id: a.id,
                        kind: a.kind,
                        secureUrl: a.secureUrl,
                        originalFilename: a.originalFilename,
                        format: a.format,
                        bytes: a.bytes
                    }}
                />
            ))}
        </div>
    );
}
