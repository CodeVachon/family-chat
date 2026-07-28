import { getSession } from "@/lib/dal";
import { countUnreadForUser } from "@/lib/queries/channels";

export const runtime = "nodejs";

/**
 * The signed-in user's total unread count.
 *
 * Exists for the service worker: when a push arrives it needs the current total
 * to put on the app-icon badge, and a push payload can't be trusted to carry one
 * (pushes are coalesced per channel, and reads on another device would leave a
 * payload-derived count stale). Asking for the live number instead makes the
 * badge self-healing — whatever the app missed, the next push corrects.
 */
export async function GET() {
    const session = await getSession();
    if (!session || session.user.approvalStatus !== "approved") {
        return new Response("Unauthorized", { status: 401 });
    }

    const total = await countUnreadForUser(session.user.id);

    return Response.json(
        { total },
        // A count is only ever meaningful right now.
        { headers: { "cache-control": "no-store" } }
    );
}
