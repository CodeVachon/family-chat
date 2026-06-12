import { ChannelActivityFeed } from "@/components/channels/channel-activity-feed";
import { requireApprovedUser } from "@/lib/dal";
import { listChannelActivity } from "@/lib/queries/channels";

export default async function ChannelsIndexPage() {
    const user = await requireApprovedUser();
    const channels = await listChannelActivity(user.id);

    return <ChannelActivityFeed channels={channels} />;
}
