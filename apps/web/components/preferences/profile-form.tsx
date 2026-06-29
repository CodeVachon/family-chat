"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BannerField } from "@/components/preferences/banner-field";
import { TextField } from "@/components/auth/text-field";
import { AvatarEditor } from "@/components/upload/avatar-editor";
import { CropFieldControls } from "@/components/upload/crop-field-controls";
import { useCropField } from "@/components/upload/use-crop-field";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import { updateAvatar, updateProfile } from "@/lib/actions/preferences";
import { formatPhoneDisplay, formatPhoneInput } from "@/lib/phone";
import { avatarUrl as avatarTransform, type AvatarCrop } from "@/lib/cloudinary/url";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
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
    initial: {
        displayName: string;
        colorHue: number;
        avatarUrl: string | null;
        avatarSourceUrl: string | null;
        avatarCrop: AvatarCrop | null;
        bannerUrl: string | null;
        bannerSourceUrl: string | null;
        bannerCrop: AvatarCrop | null;
        bio: string;
        phone: string;
        fallbackName: string;
    };
}) {
    const router = useRouter();
    const [displayName, setDisplayName] = useState(initial.displayName);
    const [colorHue, setColorHue] = useState(initial.colorHue);
    const [bio, setBio] = useState(initial.bio);
    const [phone, setPhone] = useState(
        initial.phone ? formatPhoneDisplay(initial.phone) : initial.phone
    );
    const [pending, setPending] = useState(false);

    // The avatar is its own immediately-saved unit (the editor's "Save crop" /
    // "Remove" commit via updateAvatar), so its crop sticks without the form's
    // "Save changes". Its current value still rides along in the save payload.
    const avatar = useCropField({
        initialUrl: initial.avatarUrl,
        initialSourceUrl: initial.avatarSourceUrl,
        initialCrop: initial.avatarCrop,
        transform: avatarTransform,
        persist: ({ url, sourceUrl, crop }) =>
            updateAvatar({ avatarUrl: url, avatarSourceUrl: sourceUrl, avatarCrop: crop }),
        label: "Avatar"
    });

    const previewName = displayName.trim() || initial.fallbackName;

    async function save() {
        setPending(true);
        try {
            await updateProfile({
                displayName: displayName.trim() || null,
                colorHue,
                avatarUrl: avatar.url,
                avatarSourceUrl: avatar.sourceUrl,
                avatarCrop: avatar.crop,
                bio: bio.trim() || null,
                phone: phone.trim() || null
            });
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
            <div className="flex items-center gap-4">
                <UserAvatar
                    name={previewName}
                    colorHue={colorHue}
                    avatarUrl={avatar.url}
                    className="size-16"
                />
                <CropFieldControls
                    hasImage={!!avatar.url}
                    canAdjust={!!(avatar.url && avatar.editSource)}
                    uploading={avatar.uploading}
                    uploadLabel="Upload avatar"
                    changeLabel="Change avatar"
                    onPickFile={avatar.openForFile}
                    onAdjust={avatar.openForExisting}
                    onRemove={() => void avatar.remove()}
                />
            </div>

            <AvatarEditor
                open={avatar.editorOpen}
                imageSrc={avatar.editorSrc}
                initialCrop={avatar.pendingFile ? null : avatar.crop}
                onCancel={avatar.closeEditor}
                onComplete={(pixels) => void avatar.onCropComplete(pixels)}
            />

            <BannerField
                initialBannerUrl={initial.bannerUrl}
                initialSourceUrl={initial.bannerSourceUrl}
                initialCrop={initial.bannerCrop}
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
                <Label htmlFor="bio">About me</Label>
                <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A short blurb about yourself"
                    maxLength={280}
                    rows={3}
                />
            </div>

            <TextField
                id="phone"
                label="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhone((p) => formatPhoneInput(p))}
                placeholder="Optional"
                maxLength={30}
            />

            <div className="flex flex-col gap-2">
                <Label>Your name color</Label>
                <p className="text-sm text-muted-foreground">
                    Used for your name and avatar ring across the app.
                </p>
                <div className="flex items-center gap-3">
                    <span
                        aria-hidden
                        className="size-7 shrink-0 rounded-full border"
                        style={{ background: `oklch(0.6 0.18 ${colorHue})` }}
                    />
                    <input
                        type="range"
                        min={0}
                        max={360}
                        value={colorHue}
                        onChange={(e) => setColorHue(Number(e.target.value))}
                        className="hue-slider"
                        style={
                            { "--hue-color": `oklch(0.6 0.18 ${colorHue})` } as React.CSSProperties
                        }
                        aria-label="Your name color"
                    />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Preview name={previewName} colorHue={colorHue} avatarUrl={avatar.url} />
                    <Preview name={previewName} colorHue={colorHue} avatarUrl={avatar.url} dark />
                </div>
            </div>

            <div>
                <Button onClick={() => void save()} disabled={pending || avatar.uploading}>
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
