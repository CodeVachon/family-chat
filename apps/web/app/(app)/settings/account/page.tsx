import { AccountForm } from "@/components/preferences/account-form";
import { requireApprovedUser } from "@/lib/dal";

export default async function AccountSettingsPage() {
    const user = await requireApprovedUser();
    return <AccountForm email={user.email} />;
}
