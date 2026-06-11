"use client";

import { Check, ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { ChannelIcon } from "@/components/channels/channel-icon";
import { ImageUploadField } from "@/components/upload/image-upload-field";
import { updateAppSettings } from "@/lib/actions/app-settings";
import { avatarUrl as squareCrop } from "@/lib/cloudinary/url";
import type { PublicChannel } from "@/lib/queries/channels";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

export function ApplicationForm({
    initial,
    publicChannels
}: {
    initial: { name: string; iconUrl: string | null; defaultChannelIds: string[] };
    publicChannels: PublicChannel[];
}) {
    const router = useRouter();
    const [name, setName] = useState(initial.name);
    const [iconUrl, setIconUrl] = useState(initial.iconUrl);
    const [defaultChannelIds, setDefaultChannelIds] = useState<string[]>(initial.defaultChannelIds);
    const [uploading, setUploading] = useState(false);
    const [pending, setPending] = useState(false);

    function toggleChannel(id: string) {
        setDefaultChannelIds((ids) =>
            ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
        );
    }

    async function save() {
        setPending(true);
        try {
            await updateAppSettings({ name: name.trim(), iconUrl, defaultChannelIds });
            toast.success("Application settings updated");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save");
        } finally {
            setPending(false);
        }
    }

    return (
        <div data-component="ApplicationForm" className="flex max-w-md flex-col gap-6">
            <div className="flex flex-col gap-2">
                <Label>Icon</Label>
                <ImageUploadField
                    value={iconUrl}
                    onChange={setIconUrl}
                    transform={squareCrop}
                    uploadLabel="Upload icon"
                    onUploadingChange={setUploading}
                    renderPreview={(url) => (
                        <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                            {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt="" className="size-full object-cover" />
                            ) : (
                                <ImageIcon className="size-6 text-muted-foreground" />
                            )}
                        </div>
                    )}
                />
            </div>

            <TextField
                id="appName"
                label="Chat name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
            />

            <div className="flex flex-col gap-2">
                <Label>Default channels</Label>
                <p className="text-sm text-muted-foreground">
                    New members automatically join these on approval. Only public channels can be
                    defaults.
                </p>
                {publicChannels.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                        No public channels yet. Create one to set it as a default.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {publicChannels.map((channel) => {
                            const selected = defaultChannelIds.includes(channel.id);
                            return (
                                <li key={channel.id}>
                                    <button
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => toggleChannel(channel.id)}
                                        className={cn(
                                            "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                                            selected
                                                ? "border-ring bg-accent"
                                                : "border-transparent bg-input/40 hover:bg-input/70"
                                        )}
                                    >
                                        <ChannelIcon
                                            icon={channel.icon}
                                            color={channel.color}
                                            className="size-4 shrink-0"
                                        />
                                        <span className="flex-1 truncate">{channel.name}</span>
                                        {selected && (
                                            <Check className="size-4 shrink-0 text-ring" />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <div>
                <Button onClick={() => void save()} disabled={pending || uploading || !name.trim()}>
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
