import { eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { userPreferences } from "@workspace/db/schema";

import { AppShell } from "@/components/app/app-shell";
import type { SidebarChannel } from "@/components/channels/channel-list";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { requireApprovedUser } from "@/lib/dal";
import { isAppStaff } from "@/lib/permissions";
import { listVisibleChannels } from "@/lib/queries/channels";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const user = await requireApprovedUser();

    const [prefs, channels] = await Promise.all([
        db.query.userPreferences.findFirst({
            where: eq(userPreferences.userId, user.id),
            columns: { colorHue: true, displayName: true }
        }),
        listVisibleChannels(user.id)
    ]);

    const sidebarChannels: SidebarChannel[] = channels.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        isPrivate: c.isPrivate,
        isArchived: c.isArchived,
        myRole: c.myRole,
        unreadCount: c.unreadCount
    }));

    return (
        <RealtimeProvider userId={user.id}>
            <AppShell
                user={{
                    name: prefs?.displayName ?? user.name,
                    email: user.email,
                    appRole: user.appRole,
                    colorHue: prefs?.colorHue ?? 220
                }}
                channels={sidebarChannels}
                canAccessAdmin={isAppStaff(user)}
            >
                {children}
            </AppShell>
        </RealtimeProvider>
    );
}
