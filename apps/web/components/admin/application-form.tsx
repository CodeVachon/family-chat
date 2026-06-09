"use client";

import { ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { ImageUploadField } from "@/components/upload/image-upload-field";
import { updateAppSettings } from "@/lib/actions/app-settings";
import { avatarUrl as squareCrop } from "@/lib/cloudinary/url";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

export function ApplicationForm({
    initial
}: {
    initial: { name: string; iconUrl: string | null };
}) {
    const router = useRouter();
    const [name, setName] = useState(initial.name);
    const [iconUrl, setIconUrl] = useState(initial.iconUrl);
    const [uploading, setUploading] = useState(false);
    const [pending, setPending] = useState(false);

    async function save() {
        setPending(true);
        try {
            await updateAppSettings({ name: name.trim(), iconUrl });
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

            <div>
                <Button onClick={() => void save()} disabled={pending || uploading || !name.trim()}>
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
