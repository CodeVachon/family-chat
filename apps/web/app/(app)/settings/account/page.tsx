import { AccountForm } from "@/components/preferences/account-form";
import { PasskeyManager } from "@/components/preferences/passkey-manager";
import { requireApprovedUser } from "@/lib/dal";
import { listUserPasskeys, userHasPassword } from "@/lib/queries/account";

export default async function AccountSettingsPage() {
    const user = await requireApprovedUser();
    const hasPassword = await userHasPassword(user.id);
    const passkeys = await listUserPasskeys(user.id);
    return (
        <div className="flex flex-col gap-8">
            <AccountForm email={user.email} hasPassword={hasPassword} />
            <PasskeyManager passkeys={passkeys} />
        </div>
    );
}
