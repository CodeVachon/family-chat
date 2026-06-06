"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useRealtime } from "@/components/realtime/realtime-provider";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import {
    addChannelMember,
    removeChannelMember,
    setChannelMemberRole
} from "@/lib/actions/channel-members";
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

function fail(err: unknown, fallback: string) {
    toast.error(err instanceof Error ? err.message : fallback);
}

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
    const router = useRouter();
    const { onlineUserIds } = useRealtime();
    const [open, setOpen] = useState(false);
    const [addUserId, setAddUserId] = useState("");
    const [addRole, setAddRole] = useState("user");
    const [busy, setBusy] = useState(false);

    async function addMember() {
        if (!addUserId || busy) return;
        setBusy(true);
        const fd = new FormData();
        fd.set("channelId", channelId);
        fd.set("userId", addUserId);
        fd.set("role", addRole);
        try {
            await addChannelMember(fd);
            toast.success("Member added");
            setAddUserId("");
            router.refresh();
        } catch (err) {
            fail(err, "Couldn't add member");
        } finally {
            setBusy(false);
        }
    }

    async function changeRole(userId: string, role: string) {
        const fd = new FormData();
        fd.set("channelId", channelId);
        fd.set("userId", userId);
        fd.set("role", role);
        try {
            await setChannelMemberRole(fd);
            router.refresh();
        } catch (err) {
            fail(err, "Couldn't update role");
        }
    }

    async function removeMember(userId: string) {
        const fd = new FormData();
        fd.set("channelId", channelId);
        fd.set("userId", userId);
        try {
            await removeChannelMember(fd);
            toast.success("Member removed");
            router.refresh();
        } catch (err) {
            fail(err, "Couldn't remove member");
        }
    }

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
                    <div className="flex items-center gap-2 rounded-lg border p-2">
                        <select
                            value={addUserId}
                            onChange={(e) => setAddUserId(e.target.value)}
                            className={cn(SELECT_CLASS, "flex-1")}
                        >
                            <option value="" disabled>
                                Add a person…
                            </option>
                            {addableUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={addRole}
                            onChange={(e) => setAddRole(e.target.value)}
                            className={SELECT_CLASS}
                        >
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            <option value="viewer">Viewer</option>
                        </select>
                        <Button size="sm" disabled={!addUserId || busy} onClick={() => void addMember()}>
                            Add
                        </Button>
                    </div>
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
                                    <select
                                        defaultValue={m.role}
                                        onChange={(e) => void changeRole(m.userId, e.target.value)}
                                        className={SELECT_CLASS}
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="user">User</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                ) : (
                                    <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                                )}
                                {editable && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void removeMember(m.userId)}
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}
