"use client";

import type { ReactionSummary } from "@/lib/queries/channels";
import { cn } from "@workspace/ui/lib/utils";

export function ReactionBar({
    reactions,
    canReact,
    onReact
}: {
    reactions: ReactionSummary[];
    canReact: boolean;
    onReact: (emoji: string) => void;
}) {
    if (reactions.length === 0) return null;

    return (
        <div data-component="ReactionBar" className="mt-1 flex flex-wrap items-center gap-1">
            {reactions.map((r) => (
                <button
                    key={r.emoji}
                    type="button"
                    disabled={!canReact}
                    onClick={() => onReact(r.emoji)}
                    className={cn(
                        "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                        r.reactedByMe
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted",
                        !canReact && "cursor-default"
                    )}
                >
                    <span>{r.emoji}</span>
                    <span className="text-muted-foreground tabular-nums">{r.count}</span>
                </button>
            ))}
        </div>
    );
}
