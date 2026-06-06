import { AppShell } from "@/components/app/app-shell";
import type { SidebarChannel } from "@/components/channels/channel-list";
import { UserPrefsProvider } from "@/components/preferences/user-prefs";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { requireApprovedUser } from "@/lib/dal";
import { isAppStaff } from "@/lib/permissions";
import { listVisibleChannels } from "@/lib/queries/channels";
import { getUserPreferences } from "@/lib/queries/preferences";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const user = await requireApprovedUser();

    const [prefs, channels] = await Promise.all([
        getUserPreferences(user.id),
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
            <UserPrefsProvider prefs={prefs}>
                <AppShell
                    user={{
                        name: prefs.displayName ?? user.name,
                        email: user.email,
                        appRole: user.appRole,
                        colorHue: prefs.colorHue,
                        avatarUrl: prefs.avatarUrl
                    }}
                    channels={sidebarChannels}
                    canAccessAdmin={isAppStaff(user)}
                >
                    {children}
                </AppShell>
            </UserPrefsProvider>
        </RealtimeProvider>
    );
}
