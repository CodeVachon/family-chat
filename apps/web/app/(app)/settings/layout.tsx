import { TabNav } from "@/components/app/tab-nav";
import { requireApprovedUser } from "@/lib/dal";

const TABS = [
    { href: "/settings/profile", label: "Profile" },
    { href: "/settings/appearance", label: "Appearance" },
    { href: "/settings/notifications", label: "Notifications" },
    { href: "/settings/account", label: "Account" }
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
    await requireApprovedUser();
    return (
        <div data-component="SettingsLayout" className="mx-auto w-full max-w-2xl px-4 py-8">
            <h1 className="mb-6 font-heading text-2xl font-semibold">Settings</h1>
            <TabNav tabs={TABS} />
            {children}
        </div>
    );
}
