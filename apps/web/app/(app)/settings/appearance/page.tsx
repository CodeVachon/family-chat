import { AppearanceForm } from "@/components/preferences/appearance-form";
import { requireApprovedUser } from "@/lib/dal";
import { getUserPreferences } from "@/lib/queries/preferences";

export default async function AppearanceSettingsPage() {
    const user = await requireApprovedUser();
    const prefs = await getUserPreferences(user.id);

    return (
        <AppearanceForm
            initial={{
                themePreference: prefs.themePreference,
                dateTimeFormat: prefs.dateTimeFormat
            }}
        />
    );
}
