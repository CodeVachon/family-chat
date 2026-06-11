import { Timestamp } from "@/components/preferences/user-prefs";
import { UserName } from "@/components/user/user-identity";
import type { ChannelMessage } from "@/lib/queries/channels";

/**
 * An inline join/leave announcement rendered in the channel timeline: centered
 * and muted, with no avatar, toolbar, reactions, or thread affordances. The
 * announcement is authored by its subject, so the author relation supplies the
 * name/color for the mention.
 */
export function SystemMessageRow({ message }: { message: ChannelMessage }) {
    const event = message.systemEvent;
    if (!event) return null;

    const prefs = message.author.preferences;
    const name = prefs?.displayName ?? message.author.name;
    const hue = prefs?.colorHue ?? 220;

    const isSelf = event.actorUserId === event.subjectUserId;
    const verb =
        event.event === "join"
            ? isSelf
                ? "joined the channel"
                : "was added to the channel"
            : isSelf
              ? "left the channel"
              : "was removed from the channel";

    return (
        <div
            data-component="SystemMessageRow"
            className="flex items-center justify-center gap-1.5 px-4 py-1 text-center text-xs text-muted-foreground"
        >
            <UserName name={name} colorHue={hue} className="text-xs font-medium" />
            <span>{verb}</span>
            <Timestamp date={message.createdAt} className="text-muted-foreground/70" />
        </div>
    );
}
