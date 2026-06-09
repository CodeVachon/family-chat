"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { toggleReaction } from "@/lib/actions/reactions";
import type { ReactionSummary } from "@/lib/queries/channels";
import { cn } from "@workspace/ui/lib/utils";

export function ReactionBar({
    messageId,
    reactions,
    canReact
}: {
    messageId: string;
    reactions: ReactionSummary[];
    canReact: boolean;
}) {
    const router = useRouter();
    if (reactions.length === 0) return null;

    async function react(emoji: string) {
        if (!canReact) return;
        try {
            await toggleReaction(messageId, emoji);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't update reaction");
        }
    }

    return (
        <div data-component="ReactionBar" className="mt-1 flex flex-wrap items-center gap-1">
            {reactions.map((r) => (
                <button
                    key={r.emoji}
                    type="button"
                    disabled={!canReact}
                    onClick={() => react(r.emoji)}
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
