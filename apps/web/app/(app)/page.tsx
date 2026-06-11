import { redirect } from "next/navigation";

import { requireApprovedUser } from "@/lib/dal";
import { resolveLastActiveChannelId } from "@/lib/queries/channels";

// App entry (post-login landing). Drop the user back into the channel they were
// most recently active in; otherwise fall through to the activity feed. The
// logo links to /channels directly, so the feed always stays reachable.
export default async function HomePage() {
    const user = await requireApprovedUser();
    const lastChannelId = await resolveLastActiveChannelId(user.id);
    redirect(lastChannelId ? `/channels/${lastChannelId}` : "/channels");
}
