import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { cache } from "react";

import { db } from "@workspace/db/client";
import { account } from "@workspace/db/schema";

/**
 * Whether the user has a credential (email/password) account with a password
 * set. Magic-link / social-only users have no such row, so they can set an
 * initial password without supplying a previous one.
 */
export const userHasPassword = cache(async (userId: string): Promise<boolean> => {
    const row = await db.query.account.findFirst({
        columns: { id: true },
        where: and(
            eq(account.userId, userId),
            eq(account.providerId, "credential"),
            isNotNull(account.password)
        )
    });
    return row !== undefined;
});
