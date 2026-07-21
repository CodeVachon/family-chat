import { AppShell } from "@/components/app/app-shell";
import type { SidebarChannel } from "@/components/channels/channel-list";
import { UserPrefsProvider } from "@/components/preferences/user-prefs";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { requireApprovedUser } from "@/lib/dal";
import { isAppStaff } from "@/lib/permissions";
import { getAppSettings } from "@/lib/queries/app-settings";
import { listVisibleChannels } from "@/lib/queries/channels";
import { getUserPreferences } from "@/lib/queries/preferences";
import { countPendingUsers } from "@/lib/queries/users";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const user = await requireApprovedUser();
    const isStaff = isAppStaff(user);

    const [prefs, channels, appSettings, pendingApprovals] = await Promise.all([
        getUserPreferences(user.id),
        listVisibleChannels(user.id),
        getAppSettings(),
        // Only staff can act on approvals, so only they need the count.
        isStaff ? countPendingUsers() : Promise.resolve(0)
    ]);

    const sidebarChannels: SidebarChannel[] = channels.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        isPrivate: c.isPrivate,
        isArchived: c.isArchived,
        isFavorite: c.isFavorite,
        myRole: c.myRole,
        unreadCount: c.unreadCount,
        mentionCount: c.mentionCount
    }));

    return (
        <RealtimeProvider userId={user.id} notificationLevel={prefs.notificationLevel}>
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
                    canAccessAdmin={isStaff}
                    pendingApprovals={pendingApprovals}
                    appName={appSettings.name}
                    appIconUrl={appSettings.iconUrl}
                >
                    {children}
                </AppShell>
            </UserPrefsProvider>
        </RealtimeProvider>
    );
}
