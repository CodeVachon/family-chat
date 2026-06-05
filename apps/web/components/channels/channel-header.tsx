import { Lock, Settings, Users } from "lucide-react";

import { ChannelDialog } from "@/components/channels/channel-dialog";
import { ChannelIcon } from "@/components/channels/channel-icon";
import { MembersDialog } from "@/components/channels/members-dialog";
import type { Channel } from "@workspace/db/schema";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";

type Member = {
    userId: string;
    role: string;
    name: string;
    colorHue: number;
    avatarUrl: string | null;
};

export function ChannelHeader({
    channel,
    canManage,
    canManageMembers,
    members,
    addableUsers
}: {
    channel: Channel;
    canManage: boolean;
    canManageMembers: boolean;
    members: Member[];
    addableUsers: { id: string; name: string }[];
}) {
    return (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
            <ChannelIcon icon={channel.icon} color={channel.color} className="size-5 shrink-0" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <h1 className="truncate font-heading text-base font-semibold">{channel.name}</h1>
                    {channel.isPrivate && <Lock className="size-3.5 shrink-0 text-muted-foreground" />}
                    {channel.isArchived && (
                        <Badge variant="outline" className="shrink-0">
                            Archived
                        </Badge>
                    )}
                </div>
                {channel.description && (
                    <p className="truncate text-xs text-muted-foreground">{channel.description}</p>
                )}
            </div>

            <MembersDialog
                channelId={channel.id}
                members={members}
                canManage={canManageMembers}
                addableUsers={addableUsers}
                trigger={
                    <Button variant="ghost" size="sm">
                        <Users className="size-4" />
                        {members.length}
                    </Button>
                }
            />

            {canManage && (
                <ChannelDialog
                    channel={{
                        id: channel.id,
                        name: channel.name,
                        description: channel.description,
                        color: channel.color,
                        icon: channel.icon,
                        isPrivate: channel.isPrivate,
                        isArchived: channel.isArchived
                    }}
                    trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Channel settings">
                            <Settings className="size-4" />
                        </Button>
                    }
                />
            )}
        </header>
    );
}
