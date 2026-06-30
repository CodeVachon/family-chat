import { AccountForm } from "@/components/preferences/account-form";
import { requireApprovedUser } from "@/lib/dal";
import { userHasPassword } from "@/lib/queries/account";

export default async function AccountSettingsPage() {
    const user = await requireApprovedUser();
    const hasPassword = await userHasPassword(user.id);
    return <AccountForm email={user.email} hasPassword={hasPassword} />;
}
