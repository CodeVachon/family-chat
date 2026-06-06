import { forbidden } from "next/navigation";

import { TabNav } from "@/components/app/tab-nav";
import { requireApprovedUser } from "@/lib/dal";
import { isAppStaff } from "@/lib/permissions";

const TABS = [
    { href: "/admin/approvals", label: "Approvals" },
    { href: "/admin/users", label: "Users" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await requireApprovedUser();
    if (!isAppStaff(user)) {
        forbidden();
    }

    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
            <h1 className="mb-6 font-heading text-2xl font-semibold">Administration</h1>
            <TabNav tabs={TABS} />
            {children}
        </div>
    );
}
