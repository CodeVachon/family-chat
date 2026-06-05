"use client";

import { useState } from "react";

import {
    addChannelMember,
    removeChannelMember,
    setChannelMemberRole
} from "@/lib/actions/channel-members";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import { Button } from "@workspace/ui/components/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@workspace/ui/components/dialog";
import { cn } from "@workspace/ui/lib/utils";

type Member = {
    userId: string;
    role: string;
    name: string;
    colorHue: number;
    avatarUrl: string | null;
};

const SELECT_CLASS =
    "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring";

export function MembersDialog({
    trigger,
    channelId,
    members,
    canManage,
    addableUsers
}: {
    trigger: React.ReactNode;
    channelId: string;
    members: Member[];
    canManage: boolean;
    addableUsers: { id: string; name: string }[];
}) {
    const [open, setOpen] = useState(false);
    const { onlineUserIds } = useRealtime();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={trigger as React.ReactElement} />
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Members</DialogTitle>
                    <DialogDescription>
                        {canManage
                            ? "Manage who can access this channel and their roles."
                            : "People in this channel."}
                    </DialogDescription>
                </DialogHeader>

                {canManage && addableUsers.length > 0 && (
                    <form
                        action={addChannelMember}
                        className="flex items-center gap-2 rounded-lg border p-2"
                    >
                        <input type="hidden" name="channelId" value={channelId} />
                        <select name="userId" className={cn(SELECT_CLASS, "flex-1")} defaultValue="">
                            <option value="" disabled>
                                Add a person…
                            </option>
                            {addableUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                        <select name="role" className={SELECT_CLASS} defaultValue="user">
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            <option value="viewer">Viewer</option>
                        </select>
                        <Button type="submit" size="sm">
                            Add
                        </Button>
                    </form>
                )}

                <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                    {members.map((m) => {
                        const isOwner = m.role === "owner";
                        const editable = canManage && !isOwner;
                        const online = onlineUserIds.has(m.userId);
                        return (
                            <div key={m.userId} className="flex items-center gap-2 rounded-lg p-1.5">
                                <div className="relative">
                                    <UserAvatar
                                        name={m.name}
                                        colorHue={m.colorHue}
                                        avatarUrl={m.avatarUrl}
                                        className="size-7"
                                    />
                                    {online && (
                                        <span
                                            className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-green-500 ring-2 ring-popover"
                                            title="Online"
                                        />
                                    )}
                                </div>
                                <UserName name={m.name} colorHue={m.colorHue} className="flex-1 truncate text-sm" />
                                {editable ? (
                                    <form action={setChannelMemberRole} className="flex items-center gap-1">
                                        <input type="hidden" name="channelId" value={channelId} />
                                        <input type="hidden" name="userId" value={m.userId} />
                                        <select
                                            name="role"
                                            className={SELECT_CLASS}
                                            defaultValue={m.role}
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="user">User</option>
                                            <option value="viewer">Viewer</option>
                                        </select>
                                        <Button type="submit" size="sm" variant="outline">
                                            Save
                                        </Button>
                                    </form>
                                ) : (
                                    <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                                )}
                                {editable && (
                                    <form action={removeChannelMember}>
                                        <input type="hidden" name="channelId" value={channelId} />
                                        <input type="hidden" name="userId" value={m.userId} />
                                        <Button type="submit" size="sm" variant="ghost">
                                            Remove
                                        </Button>
                                    </form>
                                )}
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}
