"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ImageIcon } from "lucide-react";

import { TextField } from "@/components/auth/text-field";
import { AvatarEditor } from "@/components/upload/avatar-editor";
import { ImageUploadField } from "@/components/upload/image-upload-field";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import { updateAvatar, updateProfile } from "@/lib/actions/preferences";
import { uploadToCloudinary } from "@/lib/cloudinary/upload-client";
import {
    avatarUrl as avatarTransform,
    bannerUrl as bannerTransform,
    originalUrl,
    type AvatarCrop
} from "@/lib/cloudinary/url";
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
        bio: string;
        phone: string;
        fallbackName: string;
    };
}) {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [displayName, setDisplayName] = useState(initial.displayName);
    const [colorHue, setColorHue] = useState(initial.colorHue);
    const [avatar, setAvatar] = useState(initial.avatarUrl);
    const [sourceUrl, setSourceUrl] = useState(initial.avatarSourceUrl);
    const [crop, setCrop] = useState<AvatarCrop | null>(initial.avatarCrop);
    const [banner, setBanner] = useState(initial.bannerUrl);
    const [bio, setBio] = useState(initial.bio);
    const [phone, setPhone] = useState(initial.phone);
    const [uploading, setUploading] = useState(false);
    const [bannerUploading, setBannerUploading] = useState(false);
    const [pending, setPending] = useState(false);

    // Avatar editor state. `editorSrc` is the image being cropped (a local
    // object URL for a freshly picked file, or the stored source URL when
    // re-adjusting); `pendingFile` is set only in the former case.
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorSrc, setEditorSrc] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    const previewName = displayName.trim() || initial.fallbackName;

    // The image to (re-)crop: the stored raw source when we have one, otherwise
    // the raw image recovered from the baked avatar URL — so avatars created
    // before the editor (no stored source) can still be re-cropped.
    const editSource = sourceUrl ?? (avatar ? originalUrl(avatar) : null);

    function openEditorForFile(file: File) {
        // Revoke any prior object URL before replacing it.
        if (pendingFile && editorSrc) URL.revokeObjectURL(editorSrc);
        setPendingFile(file);
        setEditorSrc(URL.createObjectURL(file));
        setEditorOpen(true);
    }

    function openEditorForExisting() {
        if (!editSource) return;
        setPendingFile(null);
        setEditorSrc(editSource);
        setEditorOpen(true);
    }

    function closeEditor() {
        if (pendingFile && editorSrc) URL.revokeObjectURL(editorSrc);
        setEditorOpen(false);
        setEditorSrc(null);
        setPendingFile(null);
    }

    async function onCropComplete(pixels: AvatarCrop) {
        try {
            // For a freshly picked file, upload to get a raw source; otherwise
            // crop the source the editor was opened on (the stored source, or
            // the one derived from the existing avatar).
            let src = editorSrc;
            if (pendingFile) {
                setUploading(true);
                const res = await uploadToCloudinary(pendingFile);
                src = res.secureUrl;
            }
            if (!src) return;
            const nextAvatar = avatarTransform(src, pixels);
            // The avatar is its own saved unit — persist immediately so "Save
            // crop" sticks without needing the form's "Save changes". The
            // source is kept so subsequent edits restore this crop (and it
            // backfills avatarSourceUrl for previously-sourceless avatars).
            await updateAvatar({
                avatarUrl: nextAvatar,
                avatarSourceUrl: src,
                avatarCrop: pixels
            });
            setSourceUrl(src);
            setCrop(pixels);
            setAvatar(nextAvatar);
            toast.success("Avatar updated");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't update avatar");
        } finally {
            setUploading(false);
            closeEditor();
        }
    }

    async function removeAvatar() {
        try {
            await updateAvatar({ avatarUrl: null, avatarSourceUrl: null, avatarCrop: null });
            setAvatar(null);
            setSourceUrl(null);
            setCrop(null);
            toast.success("Avatar removed");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't remove avatar");
        }
    }

    async function save() {
        setPending(true);
        try {
            await updateProfile({
                displayName: displayName.trim() || null,
                colorHue,
                avatarUrl: avatar,
                avatarSourceUrl: sourceUrl,
                avatarCrop: crop,
                bannerUrl: banner,
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
                    avatarUrl={avatar}
                    className="size-16"
                />
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) openEditorForFile(f);
                            e.target.value = "";
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                    >
                        {uploading ? "Uploading…" : avatar ? "Change avatar" : "Upload avatar"}
                    </Button>
                    {avatar && editSource && (
                        <Button type="button" variant="outline" onClick={openEditorForExisting}>
                            Adjust crop
                        </Button>
                    )}
                    {avatar && (
                        <Button type="button" variant="ghost" onClick={() => void removeAvatar()}>
                            Remove
                        </Button>
                    )}
                </div>
            </div>

            <AvatarEditor
                open={editorOpen}
                imageSrc={editorSrc}
                initialCrop={pendingFile ? null : crop}
                onCancel={closeEditor}
                onComplete={(pixels) => void onCropComplete(pixels)}
            />

            <div className="flex flex-col gap-2">
                <Label>Profile banner</Label>
                <ImageUploadField
                    value={banner}
                    onChange={setBanner}
                    transform={bannerTransform}
                    uploadLabel="Upload banner"
                    onUploadingChange={setBannerUploading}
                    renderPreview={(url) => (
                        <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border bg-muted">
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
                    <Preview name={previewName} colorHue={colorHue} avatarUrl={avatar} />
                    <Preview name={previewName} colorHue={colorHue} avatarUrl={avatar} dark />
                </div>
            </div>

            <div>
                <Button
                    onClick={() => void save()}
                    disabled={pending || uploading || bannerUploading}
                >
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
