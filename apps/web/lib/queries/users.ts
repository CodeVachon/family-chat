import "server-only";

import { asc, count, eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { user as userTable } from "@workspace/db/schema";

/** All approved users (id + name), for member-picker UIs. */
export async function listApprovedUsers() {
    return db.query.user.findMany({
        where: eq(userTable.approvalStatus, "approved"),
        orderBy: asc(userTable.name),
        columns: { id: true, name: true }
    });
}

/** Number of users awaiting approval — drives the staff pending-actions badge. */
export async function countPendingUsers(): Promise<number> {
    const [row] = await db
        .select({ value: count() })
        .from(userTable)
        .where(eq(userTable.approvalStatus, "pending"));
    return row?.value ?? 0;
}
