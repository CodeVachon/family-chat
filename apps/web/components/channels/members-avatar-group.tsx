"use client";

import { useRealtime } from "@/components/realtime/realtime-provider";
import { initials } from "@/components/user/user-identity";
import { identityTintStyle } from "@/lib/color/identity";
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
            {shown.map((m, index) => {
                const online = onlineUserIds.has(m.userId);
                return (
                    // Avatars overlap (-space-x-2). Stack them left-on-top by giving
                    // each a descending z-index, so the leftmost (online-sorted-first)
                    // avatar reads clearly and each one to the right sits behind.
                    <Avatar
                        key={m.userId}
                        className={online ? "relative" : "relative opacity-60"}
                        style={{ zIndex: shown.length - index }}
                    >
                        {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt={m.name} /> : null}
                        <AvatarFallback
                            data-user-tint
                            style={identityTintStyle(m.colorHue) as React.CSSProperties}
                        >
                            {initials(m.name)}
                        </AvatarFallback>
                        {online && <AvatarBadge className="bg-green-500" title="Online" />}
                    </Avatar>
                );
            })}
            {overflow > 0 && (
                <AvatarGroupCount className="relative" style={{ zIndex: 0 }}>
                    +{overflow}
                </AvatarGroupCount>
            )}
        </AvatarGroup>
    );
}
