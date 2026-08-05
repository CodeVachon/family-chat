import { identityTintStyle } from "@/lib/color/identity";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { cn } from "@workspace/ui/lib/utils";

export function initials(name: string): string {
    return (
        name
            .split(/\s+/)
            .map((part) => part[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase() || "?"
    );
}

/** A user's display name tinted with their chosen identity color. */
export function UserName({
    name,
    colorHue,
    className
}: {
    name: string;
    colorHue: number;
    className?: string;
}) {
    return (
        <span
            data-component="UserName"
            data-user-tint
            className={cn("font-medium", className)}
            style={identityTintStyle(colorHue) as React.CSSProperties}
        >
            {name}
        </span>
    );
}

/** A user's avatar with a ring in their identity color. */
export function UserAvatar({
    name,
    colorHue,
    avatarUrl,
    className
}: {
    name: string;
    colorHue: number;
    avatarUrl?: string | null;
    className?: string;
}) {
    return (
        <Avatar
            data-user-ring
            className={cn("ring-2", className)}
            style={identityTintStyle(colorHue) as React.CSSProperties}
        >
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
    );
}
