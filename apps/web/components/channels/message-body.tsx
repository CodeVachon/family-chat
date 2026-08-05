import { Fragment } from "react";

import { identityTintStyle } from "@/lib/color/identity";
import { isHtmlBody, renderMessageHtml } from "@/lib/messaging/rich-text";
import type { MentionSummary } from "@/lib/queries/channels";

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Legacy plain-text bodies: render with `@Name` tokens highlighted. */
function PlainTextBody({ body, mentions }: { body: string; mentions: MentionSummary[] }) {
    const base = "channel-message-text [overflow-wrap:anywhere] whitespace-pre-wrap";
    if (mentions.length === 0) {
        return (
            <p data-component="PlainTextBody" className={base}>
                {body}
            </p>
        );
    }

    const byName = new Map(mentions.map((m) => [m.name, m]));
    const pattern = new RegExp(`@(${mentions.map((m) => escapeRegex(m.name)).join("|")})`, "g");

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    for (let match = pattern.exec(body); match !== null; match = pattern.exec(body)) {
        if (match.index > cursor) nodes.push(body.slice(cursor, match.index));
        const mention = byName.get(match[1]!);
        nodes.push(
            <span
                key={key++}
                data-user-tint
                className="rounded bg-primary/10 px-0.5 font-medium"
                style={identityTintStyle(mention?.colorHue ?? 220) as React.CSSProperties}
            >
                @{match[1]}
            </span>
        );
        cursor = match.index + match[0].length;
    }
    if (cursor < body.length) nodes.push(body.slice(cursor));

    return (
        <p data-component="PlainTextBody" className={base}>
            {nodes.map((n, i) => (
                <Fragment key={i}>{n}</Fragment>
            ))}
        </p>
    );
}

/** Render a message body. New messages are sanitized HTML; older ones plain text. */
export function MessageBody({ body, mentions }: { body: string; mentions: MentionSummary[] }) {
    if (!isHtmlBody(body)) {
        return <PlainTextBody body={body} mentions={mentions} />;
    }

    const html = renderMessageHtml(
        body,
        mentions.map((m) => ({ id: m.userId, colorHue: m.colorHue }))
    );

    return (
        <div
            data-component="MessageBody"
            className="tiptap-content channel-message-text [overflow-wrap:anywhere]"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
