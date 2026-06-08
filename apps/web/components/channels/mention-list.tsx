"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

import { cn } from "@workspace/ui/lib/utils";

export type MentionItem = { id: string; name: string };

export type MentionListHandle = { onKeyDown: (event: KeyboardEvent) => boolean };

/**
 * Dropdown rendered by the Tiptap mention suggestion plugin. Exposes an
 * imperative `onKeyDown` so the plugin can drive keyboard navigation.
 */
export const MentionList = forwardRef<
    MentionListHandle,
    { items: MentionItem[]; command: (item: { id: string; label: string }) => void }
>(({ items, command }, ref) => {
    const [index, setIndex] = useState(0);

    useEffect(() => setIndex(0), [items]);

    const select = (i: number) => {
        const item = items[i];
        if (item) command({ id: item.id, label: item.name });
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: (event) => {
            if (items.length === 0) return false;
            if (event.key === "ArrowUp") {
                setIndex((i) => (i - 1 + items.length) % items.length);
                return true;
            }
            if (event.key === "ArrowDown") {
                setIndex((i) => (i + 1) % items.length);
                return true;
            }
            if (event.key === "Enter" || event.key === "Tab") {
                select(index);
                return true;
            }
            return false;
        }
    }));

    if (items.length === 0) return null;

    return (
        <div className="w-56 overflow-hidden rounded-lg border bg-popover shadow-md">
            {items.map((item, i) => (
                <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        select(i);
                    }}
                    className={cn(
                        "block w-full px-3 py-1.5 text-left text-sm",
                        i === index ? "bg-muted" : "hover:bg-muted/60"
                    )}
                >
                    @{item.name}
                </button>
            ))}
        </div>
    );
});

MentionList.displayName = "MentionList";
