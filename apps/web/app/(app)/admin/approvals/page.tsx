import { asc, eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { user as userTable } from "@workspace/db/schema";

import { approveUser, rejectUser } from "@/lib/actions/admin";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";

export default async function ApprovalsPage() {
    const pending = await db.query.user.findMany({
        where: eq(userTable.approvalStatus, "pending"),
        orderBy: asc(userTable.createdAt),
        columns: { id: true, name: true, email: true, createdAt: true }
    });

    if (pending.length === 0) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                    No accounts are waiting for approval.
                </CardContent>
            </Card>
        );
    }

    return (
        <div data-component="ApprovalsPage" className="flex flex-col gap-3">
            {pending.map((u) => (
                <Card key={u.id}>
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="truncate font-medium">{u.name}</p>
                            <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <form action={approveUser}>
                                <input type="hidden" name="userId" value={u.id} />
                                <Button type="submit" size="sm">
                                    Approve
                                </Button>
                            </form>
                            <form action={rejectUser}>
                                <input type="hidden" name="userId" value={u.id} />
                                <Button type="submit" size="sm" variant="destructive">
                                    Reject
                                </Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
