import { eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { userPreferences } from "@workspace/db/schema";

import { AppShell } from "@/components/app/app-shell";
import { requireApprovedUser } from "@/lib/dal";
import { isAppStaff } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const user = await requireApprovedUser();

    const prefs = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, user.id),
        columns: { colorHue: true, displayName: true }
    });

    return (
        <AppShell
            user={{
                name: prefs?.displayName ?? user.name,
                email: user.email,
                appRole: user.appRole,
                colorHue: prefs?.colorHue ?? 220
            }}
            canAccessAdmin={isAppStaff(user)}
        >
            {children}
        </AppShell>
    );
}
