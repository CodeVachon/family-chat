/** Pure helpers for the composer's @-mention autocomplete. */

export type MentionQuery = { query: string; start: number };

/** If the caret sits in an `@token`, return the query text and the `@` index. */
export function getMentionQuery(text: string, caret: number): MentionQuery | null {
    const before = text.slice(0, caret);
    const match = before.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return null;
    return { query: match[1] ?? "", start: caret - (match[1]?.length ?? 0) - 1 };
}

/** Replace the active `@query` with `@Name ` and return the new text + caret. */
export function applyMention(
    text: string,
    start: number,
    caret: number,
    name: string
): { text: string; caret: number } {
    const insert = `@${name} `;
    return {
        text: text.slice(0, start) + insert + text.slice(caret),
        caret: start + insert.length
    };
}
