import "server-only";

import { asc, eq } from "drizzle-orm";

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
