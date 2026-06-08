import DOMPurify from "isomorphic-dompurify";

/**
 * Shared helpers for the rich-text (Tiptap) message pipeline.
 *
 * Messages are stored as sanitized HTML in `messages.body`. These helpers run
 * on both the server (input sanitizing, plain-text derivation) and the client
 * (render-time sanitizing), so everything here must be isomorphic.
 */

/** Tags the message schema is allowed to produce. */
const ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "s",
    "u",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "span"
];

/** Attributes we permit. Mention spans carry data-id/data-label; links carry href. */
const ALLOWED_ATTR = ["href", "target", "rel", "data-type", "data-id", "data-label", "class"];

const BASE_CONFIG = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Mention spans carry data-id/data-type/data-label. data-* attributes can't
    // execute script, so allowing them is safe under our strict tag allowlist.
    ALLOW_DATA_ATTR: true,
    // Only http(s) and mailto links; blocks javascript:, data:, etc.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i
};

/**
 * Sanitize HTML produced by the editor before persisting it. Strict allowlist,
 * no inline styles. Returns clean HTML safe to store and later re-render.
 */
export function sanitizeMessageHtml(html: string): string {
    return DOMPurify.sanitize(html, BASE_CONFIG) as string;
}

/** A message body is HTML if it contains any tag; older messages are plain text. */
export function isHtmlBody(body: string): boolean {
    return /<[a-z][\s\S]*>/i.test(body);
}

/**
 * Reduce a stored body to plain text — used for emptiness checks, link-URL
 * extraction, and notification previews. Handles both HTML and legacy plain
 * text bodies.
 */
export function htmlToText(body: string): string {
    if (!isHtmlBody(body)) return body;
    const withBreaks = body
        .replace(/<\/(p|div|li|blockquote|pre)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n");
    const stripped = withBreaks.replace(/<[^>]+>/g, "");
    return decodeEntities(stripped).replace(/\n{3,}/g, "\n\n").trim();
}

function decodeEntities(text: string): string {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}

/** Wrap a legacy plain-text body as HTML so it can be loaded into the editor. */
export function plainTextToHtml(text: string): string {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const paragraphs = escaped
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
    return paragraphs || "<p></p>";
}

type MentionNode = { type?: string; attrs?: { id?: string | null }; content?: MentionNode[] };

/** Walk an editor JSON document and collect every mention node's user id. */
export function extractMentionIds(doc: unknown): string[] {
    const ids = new Set<string>();
    const visit = (node: MentionNode | undefined) => {
        if (!node || typeof node !== "object") return;
        if (node.type === "mention" && node.attrs?.id) ids.add(node.attrs.id);
        node.content?.forEach(visit);
    };
    visit(doc as MentionNode);
    return [...ids];
}

export type MentionHue = { id: string; colorHue: number };

/**
 * Sanitize a stored body for rendering and tint mention spans by the mentioned
 * user's hue. Defense-in-depth: re-sanitizes even though input was sanitized.
 */
export function renderMessageHtml(body: string, mentions: MentionHue[]): string {
    const hueById = new Map(mentions.map((m) => [m.id, m.colorHue]));

    // Hook fires per element node. Avoid `instanceof Element` — that global
    // doesn't exist on the server (isomorphic-dompurify uses jsdom internally).
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        if (node.nodeType !== 1 || typeof node.getAttribute !== "function") return;
        if (node.tagName === "SPAN" && node.getAttribute("data-type") === "mention") {
            const hue = hueById.get(node.getAttribute("data-id") ?? "") ?? 220;
            node.setAttribute("style", `color: oklch(var(--user-l) var(--user-c) ${hue})`);
        }
        if (node.tagName === "A") {
            node.setAttribute("target", "_blank");
            node.setAttribute("rel", "noopener noreferrer nofollow");
        }
    });

    try {
        return DOMPurify.sanitize(body, {
            ...BASE_CONFIG,
            ADD_ATTR: ["style"]
        }) as string;
    } finally {
        DOMPurify.removeHook("afterSanitizeAttributes");
    }
}
