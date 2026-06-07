import { NotificationsForm } from "@/components/preferences/notifications-form";
import { requireApprovedUser } from "@/lib/dal";
import { getUserPreferences } from "@/lib/queries/preferences";

export default async function NotificationsSettingsPage() {
    const user = await requireApprovedUser();
    const prefs = await getUserPreferences(user.id);
    return <NotificationsForm initial={{ notificationLevel: prefs.notificationLevel }} />;
}
