import { asc } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { user as userTable } from "@workspace/db/schema";

import { demoteToUser, promoteToAdmin } from "@/lib/actions/admin";
import { requireApprovedUser } from "@/lib/dal";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
    owner: "default",
    admin: "secondary",
    user: "outline"
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    approved: "secondary",
    pending: "outline",
    rejected: "destructive"
};

export default async function UsersPage() {
    const actor = await requireApprovedUser();
    const isOwner = actor.appRole === "owner";

    const users = await db.query.user.findMany({
        orderBy: asc(userTable.createdAt),
        columns: {
            id: true,
            name: true,
            email: true,
            appRole: true,
            approvalStatus: true
        }
    });

    return (
        <div className="flex flex-col gap-3">
            {users.map((u) => (
                <Card key={u.id}>
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="truncate font-medium">{u.name}</p>
                                <Badge variant={ROLE_VARIANT[u.appRole]}>{u.appRole}</Badge>
                                <Badge variant={STATUS_VARIANT[u.approvalStatus]}>
                                    {u.approvalStatus}
                                </Badge>
                            </div>
                            <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        {isOwner && u.appRole !== "owner" && (
                            <div className="flex shrink-0 gap-2">
                                {u.appRole === "user" ? (
                                    <form action={promoteToAdmin}>
                                        <input type="hidden" name="userId" value={u.id} />
                                        <Button type="submit" size="sm" variant="outline">
                                            Make admin
                                        </Button>
                                    </form>
                                ) : (
                                    <form action={demoteToUser}>
                                        <input type="hidden" name="userId" value={u.id} />
                                        <Button type="submit" size="sm" variant="outline">
                                            Remove admin
                                        </Button>
                                    </form>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
