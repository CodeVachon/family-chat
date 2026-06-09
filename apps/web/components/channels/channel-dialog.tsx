"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ChannelIcon } from "@/components/channels/channel-icon";
import { createChannel, setChannelArchived, updateChannel } from "@/lib/actions/channels";
import { CHANNEL_COLORS, CHANNEL_ICONS } from "@/lib/validation/channel";
import { Button } from "@workspace/ui/components/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";

/** redirect() throws a special error (with a `digest`) that must propagate. */
function isRedirectError(err: unknown): boolean {
    return typeof err === "object" && err !== null && "digest" in err;
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
        <div data-component="ColorPicker" className="flex flex-wrap gap-2">
            {CHANNEL_COLORS.map((c) => (
                <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => onChange(c)}
                    className={cn(
                        "size-7 rounded-full transition-transform",
                        value === c
                            ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                            : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                />
            ))}
        </div>
    );
}

function IconPicker({ value, onChange }: { value: string; onChange: (i: string) => void }) {
    return (
        <div data-component="IconPicker" className="flex flex-wrap gap-2">
            {CHANNEL_ICONS.map((i) => (
                <button
                    key={i}
                    type="button"
                    aria-label={`Icon ${i}`}
                    onClick={() => onChange(i)}
                    className={cn(
                        "flex size-8 items-center justify-center rounded-lg border transition-colors",
                        value === i ? "border-ring bg-muted" : "border-transparent hover:bg-muted"
                    )}
                >
                    <ChannelIcon icon={i} className="size-4" />
                </button>
            ))}
        </div>
    );
}

function ArchiveButton({
    channelId,
    isArchived,
    onDone,
    disabled
}: {
    channelId: string;
    isArchived: boolean;
    onDone: () => void;
    disabled?: boolean;
}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);

    async function handleArchive() {
        const willArchive = !isArchived;
        setPending(true);
        const formData = new FormData();
        formData.set("channelId", channelId);
        formData.set("archived", willArchive ? "true" : "false");
        try {
            await setChannelArchived(formData);
            toast.success(willArchive ? "Channel archived" : "Channel unarchived");
            onDone();
            router.refresh();
        } catch (err) {
            if (isRedirectError(err)) throw err;
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setPending(false);
        }
    }

    return (
        <Button
            type="button"
            variant="outline"
            disabled={disabled || pending}
            onClick={handleArchive}
        >
            {pending ? "Working…" : isArchived ? "Unarchive channel" : "Archive channel"}
        </Button>
    );
}

type ChannelDialogProps = {
    trigger: React.ReactNode;
    channel?: {
        id: string;
        name: string;
        description: string | null;
        color: string | null;
        icon: string | null;
        isPrivate: boolean;
        isArchived: boolean;
    };
};

export function ChannelDialog({ trigger, channel }: ChannelDialogProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={trigger as React.ReactElement} />
            <DialogContent className="sm:max-w-md">
                {/* Mount the form only while open so its state resets each time. */}
                {open && <ChannelForm channel={channel} onSaved={() => setOpen(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function ChannelForm({
    channel,
    onSaved
}: {
    channel?: ChannelDialogProps["channel"];
    onSaved: () => void;
}) {
    const router = useRouter();
    const isEdit = Boolean(channel);
    const [pending, setPending] = useState(false);
    const [color, setColor] = useState<string>(channel?.color ?? CHANNEL_COLORS[5]);
    const [icon, setIcon] = useState<string>(channel?.icon ?? CHANNEL_ICONS[0]);
    const [isPrivate, setIsPrivate] = useState(channel?.isPrivate ?? false);

    async function handleSubmit(formData: FormData) {
        formData.set("color", color);
        formData.set("icon", icon);
        formData.set("isPrivate", isPrivate ? "true" : "false");
        setPending(true);
        try {
            if (channel) {
                formData.set("channelId", channel.id);
                await updateChannel(formData);
                toast.success("Channel updated");
                onSaved();
                router.refresh();
            } else {
                // createChannel redirects to the new channel on success.
                await createChannel(formData);
            }
        } catch (err) {
            if (isRedirectError(err)) throw err;
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setPending(false);
        }
    }

    const submitLabel = pending ? "Saving…" : isEdit ? "Save changes" : "Create channel";

    return (
        <form data-component="ChannelForm" action={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
                <DialogTitle>{isEdit ? "Edit channel" : "Create channel"}</DialogTitle>
                <DialogDescription>
                    {isEdit
                        ? "Update this channel's details."
                        : "Channels organize conversations. You'll be its owner."}
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={channel?.name}
                    placeholder="general"
                />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    name="description"
                    maxLength={280}
                    defaultValue={channel?.description ?? ""}
                    placeholder="What's this channel about?"
                />
            </div>

            <div className="flex flex-col gap-2">
                <Label>Color</Label>
                <ColorPicker value={color} onChange={setColor} />
            </div>

            <div className="flex flex-col gap-2">
                <Label>Icon</Label>
                <IconPicker value={icon} onChange={setIcon} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                    <Label>Private channel</Label>
                    <p className="text-xs text-muted-foreground">
                        Only invited members can see it.
                    </p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            <DialogFooter className={channel ? "sm:justify-between" : undefined}>
                {channel && (
                    <ArchiveButton
                        channelId={channel.id}
                        isArchived={channel.isArchived}
                        onDone={onSaved}
                        disabled={pending}
                    />
                )}
                <Button type="submit" disabled={pending}>
                    {submitLabel}
                </Button>
            </DialogFooter>
        </form>
    );
}
