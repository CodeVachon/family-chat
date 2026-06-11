import { ApplicationForm } from "@/components/admin/application-form";
import { getAppSettings } from "@/lib/queries/app-settings";
import { listPublicChannels } from "@/lib/queries/channels";

export default async function ApplicationSettingsPage() {
    const [settings, publicChannels] = await Promise.all([getAppSettings(), listPublicChannels()]);
    return (
        <ApplicationForm
            initial={{
                name: settings.name,
                iconUrl: settings.iconUrl,
                defaultChannelIds: settings.defaultChannelIds
            }}
            publicChannels={publicChannels}
        />
    );
}
