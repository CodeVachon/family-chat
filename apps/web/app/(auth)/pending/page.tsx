import { redirect } from "next/navigation";

import { PendingWatcher } from "@/components/auth/pending-watcher";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getSession } from "@/lib/dal";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@workspace/ui/components/card";

export default async function PendingPage() {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }
    if (session.user.approvalStatus === "approved") {
        redirect("/");
    }

    const rejected = session.user.approvalStatus === "rejected";

    return (
        <Card>
            {/* While genuinely pending, poll for approval and auto-advance. */}
            {!rejected && <PendingWatcher />}
            <CardHeader>
                <CardTitle>{rejected ? "Access denied" : "Awaiting approval"}</CardTitle>
                <CardDescription>
                    {rejected
                        ? "Your account request was declined. Contact an administrator if you think this is a mistake."
                        : "Your account is waiting for an administrator to approve it. You'll get access as soon as they do."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    Signed in as <span className="font-medium">{session.user.email}</span>
                </p>
            </CardContent>
            <CardFooter className="flex justify-end">
                <SignOutButton />
            </CardFooter>
        </Card>
    );
}
