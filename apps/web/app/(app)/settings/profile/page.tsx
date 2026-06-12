import { ProfileForm } from "@/components/preferences/profile-form";
import { requireApprovedUser } from "@/lib/dal";
import { getUserPreferences } from "@/lib/queries/preferences";

export default async function ProfileSettingsPage() {
    const user = await requireApprovedUser();
    const prefs = await getUserPreferences(user.id);

    return (
        <ProfileForm
            initial={{
                displayName: prefs.displayName ?? "",
                colorHue: prefs.colorHue,
                avatarUrl: prefs.avatarUrl,
                avatarSourceUrl: prefs.avatarSourceUrl,
                avatarCrop: prefs.avatarCrop,
                bannerUrl: prefs.bannerUrl,
                bio: prefs.bio ?? "",
                phone: prefs.phone ?? "",
                fallbackName: user.name
            }}
        />
    );
}
