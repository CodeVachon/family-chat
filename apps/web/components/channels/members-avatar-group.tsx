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
    const shown = members.slice(0, MAX_SHOWN);
    const overflow = members.length - shown.length;

    return (
        <AvatarGroup>
            {shown.map((m) => (
                <Avatar key={m.userId}>
                    {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt={m.name} /> : null}
                    <AvatarFallback
                        style={{ color: `oklch(var(--user-l) var(--user-c) ${m.colorHue})` }}
                    >
                        {initials(m.name)}
                    </AvatarFallback>
                    {onlineUserIds.has(m.userId) && (
                        <AvatarBadge className="bg-green-500" title="Online" />
                    )}
                </Avatar>
            ))}
            {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
        </AvatarGroup>
    );
}
