import { MessageSquare } from "lucide-react";

export default function ChannelsIndexPage() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                <MessageSquare className="size-7 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-lg font-semibold">Select a channel</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
                Choose a channel from the sidebar, or create a new one to start a conversation.
            </p>
        </div>
    );
}
