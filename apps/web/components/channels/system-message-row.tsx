import type { SystemMessageEvent } from "@workspace/db/schema";

import { Timestamp } from "@/components/preferences/user-prefs";
import { UserName } from "@/components/user/user-identity";
import type { ChannelMessage } from "@/lib/queries/channels";

/** The announcement text for a system event, or null when there's nothing to say. */
function systemVerb(event: SystemMessageEvent): string | null {
    if (event.event === "channel_updated") {
        const parts: string[] = [];
        if (event.renamedTo) parts.push(`renamed the channel to ${event.renamedTo}`);
        if (event.descriptionChanged) parts.push("updated the channel description");
        return parts.length > 0 ? parts.join(" and ") : null;
    }
    const isSelf = event.actorUserId === event.subjectUserId;
    if (event.event === "join") return isSelf ? "joined the channel" : "was added to the channel";
    return isSelf ? "left the channel" : "was removed from the channel";
}

/**
 * An inline join/leave/settings-change announcement rendered in the channel
 * timeline: centered and muted, with no avatar, toolbar, reactions, or thread
 * affordances. Authored by the subject (join/leave) or the actor (settings
 * change), so the author relation supplies the name/color.
 */
export function SystemMessageRow({ message }: { message: ChannelMessage }) {
    const event = message.systemEvent;
    if (!event) return null;

    const verb = systemVerb(event);
    if (!verb) return null;

    const prefs = message.author.preferences;
    const name = prefs?.displayName ?? message.author.name;
    const hue = prefs?.colorHue ?? 220;

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
