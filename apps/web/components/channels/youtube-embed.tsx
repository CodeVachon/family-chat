/**
 * Inline 16:9 YouTube player for a YouTube link in a message. Uses the
 * privacy-enhanced `youtube-nocookie.com` embed origin (allowed narrowly in the
 * CSP `frame-src`). Rendered in place of the generic link card.
 */
export function YouTubeEmbed({ id }: { id: string }) {
    return (
        <div
            data-component="YouTubeEmbed"
            className="aspect-video w-full max-w-md overflow-hidden rounded-lg border bg-black"
        >
            <iframe
                src={`https://www.youtube-nocookie.com/embed/${id}`}
                title="YouTube video player"
                className="size-full"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
            />
        </div>
    );
}
