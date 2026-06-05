"use client";

import { useRealtime } from "@/components/realtime/realtime-provider";

function describe(names: string[]): string {
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return "Several people are typing…";
}

export function TypingIndicator({ channelId }: { channelId: string }) {
    const { typingUsersFor } = useRealtime();
    const typing = typingUsersFor(channelId);

    return (
        <div className="h-5 px-4 text-xs text-muted-foreground" aria-live="polite">
            {typing.length > 0 ? describe(typing.map((t) => t.name)) : ""}
        </div>
    );
}
