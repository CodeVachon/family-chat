import type { ComposerMember } from "@/components/channels/composer";
import { MessageItem } from "@/components/channels/message-item";
import type { MessageViewer } from "@/components/channels/message-toolbar";
import type { ChannelMessage } from "@/lib/queries/channels";

export function MessageList({
    messages,
    viewer,
    members = []
}: {
    messages: ChannelMessage[];
    viewer: MessageViewer;
    members?: ComposerMember[];
}) {
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
                <MessageItem key={m.id} message={m} viewer={viewer} members={members} />
            ))}
        </div>
    );
}
