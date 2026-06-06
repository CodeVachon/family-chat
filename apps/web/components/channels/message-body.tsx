import { Fragment } from "react";

import type { MentionSummary } from "@/lib/queries/channels";

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Render a message body, highlighting `@Name` tokens for mentioned members. */
export function MessageBody({ body, mentions }: { body: string; mentions: MentionSummary[] }) {
    const base = "text-sm break-words whitespace-pre-wrap";
    if (mentions.length === 0) {
        return <p className={base}>{body}</p>;
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
                className="rounded bg-primary/10 px-0.5 font-medium"
                style={{ color: `oklch(var(--user-l) var(--user-c) ${mention?.colorHue ?? 220})` }}
            >
                @{match[1]}
            </span>
        );
        cursor = match.index + match[0].length;
    }
    if (cursor < body.length) nodes.push(body.slice(cursor));

    return (
        <p className={base}>
            {nodes.map((n, i) => (
                <Fragment key={i}>{n}</Fragment>
            ))}
        </p>
    );
}
