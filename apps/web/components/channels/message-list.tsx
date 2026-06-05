import { UserAvatar, UserName } from "@/components/user/user-identity";
import { formatMessageTime } from "@/lib/format";
import type { ChannelMessage } from "@/lib/queries/channels";

function MessageItem({ message }: { message: ChannelMessage }) {
    const prefs = message.author.preferences;
    const name = prefs?.displayName ?? message.author.name;
    const hue = prefs?.colorHue ?? 220;
    const deleted = Boolean(message.deletedAt);

    return (
        <div className="flex gap-3 px-4 py-1.5 hover:bg-muted/30">
            <UserAvatar
                name={name}
                colorHue={hue}
                avatarUrl={prefs?.avatarUrl}
                className="mt-0.5 size-9"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <UserName name={name} colorHue={hue} className="text-sm" />
                    <span className="text-xs text-muted-foreground">
                        {formatMessageTime(message.createdAt)}
                    </span>
                    {message.editedAt && !deleted && (
                        <span className="text-xs text-muted-foreground">(edited)</span>
                    )}
                </div>
                {deleted ? (
                    <p className="text-sm text-muted-foreground italic">This message was deleted.</p>
                ) : (
                    <p className="text-sm break-words whitespace-pre-wrap">{message.body}</p>
                )}
            </div>
        </div>
    );
}

export function MessageList({ messages }: { messages: ChannelMessage[] }) {
    if (messages.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                No messages yet. Say hello!
            </div>
        );
    }

    return (
        <div className="flex flex-col py-4">
            {messages.map((m) => (
                <MessageItem key={m.id} message={m} />
            ))}
        </div>
    );
}
