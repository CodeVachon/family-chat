import { asc } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { user as userTable } from "@workspace/db/schema";

import { InviteUserForm } from "@/components/admin/invite-user-form";
import { UserAvatar } from "@/components/user/user-identity";
import { demoteToUser, promoteToAdmin, unapproveUser } from "@/lib/actions/admin";
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
        columns: { id: true, name: true, email: true, appRole: true, approvalStatus: true },
        with: { preferences: { columns: { displayName: true, colorHue: true, avatarUrl: true } } }
    });

    return (
        <div
            data-component="UsersPage"
            className="flex flex-col gap-3"
        >
            <InviteUserForm />

            {users.map((u) => {
                const prefs = u.preferences;
                const name = prefs?.displayName ?? u.name;
                return (
                    <Card key={u.id}>
                        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <UserAvatar
                                    name={name}
                                    colorHue={prefs?.colorHue ?? 220}
                                    avatarUrl={prefs?.avatarUrl ?? null}
                                />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate font-medium">{name}</p>
                                        <Badge variant={ROLE_VARIANT[u.appRole]}>{u.appRole}</Badge>
                                        <Badge variant={STATUS_VARIANT[u.approvalStatus]}>
                                            {u.approvalStatus}
                                        </Badge>
                                    </div>
                                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                                </div>
                            </div>

                            <div className="flex shrink-0 gap-2">
                                {u.approvalStatus === "approved" && u.appRole !== "owner" && (
                                    <form action={unapproveUser}>
                                        <input type="hidden" name="userId" value={u.id} />
                                        <Button type="submit" size="sm" variant="outline">
                                            Unapprove
                                        </Button>
                                    </form>
                                )}
                                {isOwner &&
                                    u.appRole !== "owner" &&
                                    (u.appRole === "user" ? (
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
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
