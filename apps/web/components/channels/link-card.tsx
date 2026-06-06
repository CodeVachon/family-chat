import type { LinkPreview } from "@workspace/db/schema";

export function LinkCard({ preview }: { preview: LinkPreview }) {
    return (
        <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full max-w-md overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
        >
            {preview.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={preview.imageUrl}
                    alt=""
                    className="size-24 shrink-0 bg-muted object-cover"
                />
            )}
            <div className="min-w-0 p-2.5">
                {preview.siteName && (
                    <p className="truncate text-xs text-muted-foreground">{preview.siteName}</p>
                )}
                {preview.title && (
                    <p className="line-clamp-2 text-sm font-medium">{preview.title}</p>
                )}
                {preview.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {preview.description}
                    </p>
                )}
            </div>
        </a>
    );
}
