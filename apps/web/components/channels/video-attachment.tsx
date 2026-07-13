export type VideoAttachmentData = {
    id: string;
    secureUrl: string;
    width: number | null;
    height: number | null;
};

export function VideoAttachment({ attachment }: { attachment: VideoAttachmentData }) {
    // Cap the player to a comfortable inline size while preserving aspect ratio
    // when Cloudinary reports the source dimensions.
    const aspectRatio =
        attachment.width && attachment.height
            ? `${attachment.width} / ${attachment.height}`
            : undefined;

    return (
        <video
            data-component="VideoAttachment"
            src={attachment.secureUrl}
            controls
            playsInline
            preload="metadata"
            style={{ aspectRatio }}
            className="w-full max-w-sm rounded-lg border bg-black"
        />
    );
}
