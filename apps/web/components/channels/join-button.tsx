import { joinChannel } from "@/lib/actions/channels";
import { Button } from "@workspace/ui/components/button";

export function JoinButton({ channelId }: { channelId: string }) {
    return (
        <form data-component="JoinButton" action={joinChannel}>
            <input type="hidden" name="channelId" value={channelId} />
            <Button type="submit" size="sm">
                Join channel
            </Button>
        </form>
    );
}
