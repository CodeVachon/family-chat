"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { ImageUploadField } from "@/components/upload/image-upload-field";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import { updateProfile } from "@/lib/actions/preferences";
import { avatarUrl as avatarTransform } from "@/lib/cloudinary/url";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

function Preview({
    name,
    colorHue,
    avatarUrl,
    dark
}: {
    name: string;
    colorHue: number;
    avatarUrl: string | null;
    dark?: boolean;
}) {
    const tokens = dark
        ? { "--user-l": "0.78", "--user-c": "0.11" }
        : { "--user-l": "0.5", "--user-c": "0.13" };

    return (
        <div
            data-component="Preview"
            style={tokens as React.CSSProperties}
            className={cn(
                "flex items-center gap-2 rounded-lg border p-3",
                dark ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"
            )}
        >
            <UserAvatar name={name} colorHue={colorHue} avatarUrl={avatarUrl} />
            <UserName name={name} colorHue={colorHue} />
            <span className={cn("ml-auto text-xs", dark ? "text-zinc-400" : "text-zinc-500")}>
                {dark ? "Dark" : "Light"}
            </span>
        </div>
    );
}

export function ProfileForm({
    initial
}: {
    initial: { displayName: string; colorHue: number; avatarUrl: string | null; fallbackName: string };
}) {
    const router = useRouter();
    const [displayName, setDisplayName] = useState(initial.displayName);
    const [colorHue, setColorHue] = useState(initial.colorHue);
    const [avatar, setAvatar] = useState(initial.avatarUrl);
    const [uploading, setUploading] = useState(false);
    const [pending, setPending] = useState(false);

    const previewName = displayName.trim() || initial.fallbackName;

    async function save() {
        setPending(true);
        try {
            await updateProfile({ displayName: displayName.trim() || null, colorHue, avatarUrl: avatar });
            toast.success("Profile updated");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save");
        } finally {
            setPending(false);
        }
    }

    return (
        <div data-component="ProfileForm" className="flex flex-col gap-6">
            <ImageUploadField
                value={avatar}
                onChange={setAvatar}
                transform={avatarTransform}
                uploadLabel="Upload avatar"
                onUploadingChange={setUploading}
                renderPreview={(url) => (
                    <UserAvatar name={previewName} colorHue={colorHue} avatarUrl={url} className="size-16" />
                )}
            />

            <TextField
                id="displayName"
                label="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={initial.fallbackName}
                maxLength={50}
            />

            <div className="flex flex-col gap-2">
                <Label>Color</Label>
                <input
                    type="range"
                    min={0}
                    max={360}
                    value={colorHue}
                    onChange={(e) => setColorHue(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: `oklch(0.6 0.18 ${colorHue})` }}
                    aria-label="Identity color hue"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Preview name={previewName} colorHue={colorHue} avatarUrl={avatar} />
                    <Preview name={previewName} colorHue={colorHue} avatarUrl={avatar} dark />
                </div>
            </div>

            <div>
                <Button onClick={() => void save()} disabled={pending || uploading}>
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
