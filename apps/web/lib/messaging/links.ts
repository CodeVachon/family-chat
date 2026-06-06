const URL_REGEX = /\bhttps?:\/\/[^\s<>()]+/gi;

/** Extract up to 5 distinct http(s) URLs from a message body. */
export function extractUrls(body: string): string[] {
    const matches = body.match(URL_REGEX) ?? [];
    const cleaned = matches.map((m) => m.replace(/[.,!?;:'"\])]+$/, ""));
    return [...new Set(cleaned)].slice(0, 5);
}
