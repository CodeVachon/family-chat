import { ApplicationForm } from "@/components/admin/application-form";
import { getAppSettings } from "@/lib/queries/app-settings";

export default async function ApplicationSettingsPage() {
    const settings = await getAppSettings();
    return <ApplicationForm initial={{ name: settings.name, iconUrl: settings.iconUrl }} />;
}
