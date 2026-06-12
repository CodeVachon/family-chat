const URL_REGEX = /\bhttps?:\/\/[^\s<>()]+/gi;

/** Extract up to 5 distinct http(s) URLs from a message body. */
export function extractUrls(body: string): string[] {
    const matches = body.match(URL_REGEX) ?? [];
    const cleaned = matches.map((m) => m.replace(/[.,!?;:'"\])]+$/, ""));
    return [...new Set(cleaned)].slice(0, 5);
}

/** YouTube video ids are 11 chars of [A-Za-z0-9_-]. */
const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * The YouTube video id for a watch/share/shorts/embed URL, or null if the URL
 * isn't a recognizable YouTube video link. Used to embed a player instead of a
 * plain link card.
 */
export function youtubeId(rawUrl: string): string | null {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    let id: string | null = null;
    if (host === "youtu.be") {
        id = url.pathname.split("/")[1] ?? null;
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        if (url.pathname === "/watch") id = url.searchParams.get("v");
        else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] ?? null;
        else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] ?? null;
    }
    return id && YOUTUBE_ID.test(id) ? id : null;
}
