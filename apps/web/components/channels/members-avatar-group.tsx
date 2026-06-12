"use client";

import { useRealtime } from "@/components/realtime/realtime-provider";
import { initials } from "@/components/user/user-identity";
import {
    Avatar,
    AvatarBadge,
    AvatarFallback,
    AvatarGroup,
    AvatarGroupCount,
    AvatarImage
} from "@workspace/ui/components/avatar";

type Member = {
    userId: string;
    name: string;
    colorHue: number;
    avatarUrl: string | null;
};

const MAX_SHOWN = 3;

export function MembersAvatarGroup({ members }: { members: Member[] }) {
    const { onlineUserIds } = useRealtime();
    // Online members first so they fill the visible slots and their badge isn't
    // hidden under an overlapping offline avatar.
    const ordered = [...members].sort(
        (a, b) => Number(onlineUserIds.has(b.userId)) - Number(onlineUserIds.has(a.userId))
    );
    const shown = ordered.slice(0, MAX_SHOWN);
    const overflow = ordered.length - shown.length;

    return (
        <AvatarGroup>
            {shown.map((m) => {
                const online = onlineUserIds.has(m.userId);
                return (
                    // Avatars overlap (-space-x-2) with later ones painting on top,
                    // so lift online avatars above their neighbors (their badge
                    // reads clearly) and fade offline ones.
                    <Avatar key={m.userId} className={online ? "relative z-10" : "opacity-60"}>
                        {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt={m.name} /> : null}
                        <AvatarFallback
                            style={{ color: `oklch(var(--user-l) var(--user-c) ${m.colorHue})` }}
                        >
                            {initials(m.name)}
                        </AvatarFallback>
                        {online && <AvatarBadge className="bg-green-500" title="Online" />}
                    </Avatar>
                );
            })}
            {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
        </AvatarGroup>
    );
}
