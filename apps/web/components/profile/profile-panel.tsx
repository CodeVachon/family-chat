import { Pencil, X } from "lucide-react";
import Link from "next/link";

import { ChannelIcon } from "@/components/channels/channel-icon";
import { UserAvatar, UserName } from "@/components/user/user-identity";
import { bannerUrl as bannerTransform, fullUrl, thumbUrl } from "@/lib/cloudinary/url";
import { getUserProfile } from "@/lib/queries/profile";

/**
 * Right-side profile panel: a social-style banner + avatar card with the user's
 * bio, phone, public channels, and uploaded files. Edit controls show only when
 * viewing your own profile.
 */
export async function ProfilePanel({
    userId,
    viewerId,
    closeHref
}: {
    userId: string;
    viewerId: string;
    closeHref: string;
}) {
    const profile = await getUserProfile(userId);
    const isSelf = viewerId === userId;

    return (
        <aside
            data-component="ProfilePanel"
            className="flex h-full min-h-0 w-full flex-col border-l bg-background lg:w-96"
        >
            <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                <h2 className="font-heading text-base font-semibold">Profile</h2>
                <Link
                    href={closeHref}
                    aria-label="Close profile"
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                    <X className="size-4" />
                </Link>
            </header>

            {!profile ? (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                    This user is not available.
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {/* Banner + overlapping avatar (social-card layout). */}
                    <div className="relative">
                        <div className="h-28 w-full bg-muted">
                            {profile.bannerUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={bannerTransform(profile.bannerUrl)}
                                    alt=""
                                    className="size-full object-cover"
                                />
                            )}
                        </div>
                        <div className="absolute -bottom-8 left-4">
                            <UserAvatar
                                name={profile.name}
                                colorHue={profile.colorHue}
                                avatarUrl={profile.avatarUrl}
                                className="size-16 ring-4 ring-background"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 px-4 pt-10 pb-6">
                        <div className="flex items-center justify-between gap-2">
                            <UserName
                                name={profile.name}
                                colorHue={profile.colorHue}
                                className="text-lg"
                            />
                            {isSelf && (
                                <Link
                                    href="/settings/profile"
                                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                                >
                                    <Pencil className="size-3" />
                                    Edit
                                </Link>
                            )}
                        </div>

                        {profile.bio && (
                            <p className="text-sm whitespace-pre-wrap text-foreground">
                                {profile.bio}
                            </p>
                        )}

                        {profile.phone && (
                            <div className="text-sm">
                                <span className="text-muted-foreground">Phone: </span>
                                <a href={`tel:${profile.phone}`} className="hover:underline">
                                    {profile.phone}
                                </a>
                            </div>
                        )}

                        {profile.email && (
                            <div className="text-sm">
                                <span className="text-muted-foreground">Email: </span>
                                <a
                                    href={`mailto:${profile.email}`}
                                    className="break-all hover:underline"
                                >
                                    {profile.email}
                                </a>
                            </div>
                        )}

                        {profile.channels.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase">
                                    Channels
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    {profile.channels.map((c) => (
                                        <Link
                                            key={c.id}
                                            href={`/channels/${c.id}`}
                                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                                        >
                                            <ChannelIcon
                                                icon={c.icon}
                                                color={c.color}
                                                className="size-3.5"
                                            />
                                            {c.name}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {profile.files.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase">
                                    Files
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {profile.files.map((f) =>
                                        f.kind === "image" ? (
                                            <a
                                                key={f.id}
                                                href={fullUrl(f.secureUrl)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="aspect-square overflow-hidden rounded-lg border bg-muted"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={thumbUrl(f.secureUrl)}
                                                    alt={f.originalFilename ?? ""}
                                                    className="size-full object-cover"
                                                />
                                            </a>
                                        ) : (
                                            <a
                                                key={f.id}
                                                href={f.secureUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={f.originalFilename ?? undefined}
                                                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border bg-muted p-2 text-center text-[10px] text-muted-foreground hover:bg-muted/70"
                                            >
                                                <span className="font-medium uppercase">
                                                    {f.kind}
                                                </span>
                                                <span className="line-clamp-2 break-all">
                                                    {f.originalFilename ?? "file"}
                                                </span>
                                            </a>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
}
