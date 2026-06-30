import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { cache } from "react";

import { db } from "@workspace/db/client";
import { account, passkey } from "@workspace/db/schema";

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

export type UserPasskey = {
    id: string;
    name: string | null;
    deviceType: string;
    createdAt: Date | null;
};

/** The current user's registered WebAuthn passkeys, newest first. */
export async function listUserPasskeys(userId: string): Promise<UserPasskey[]> {
    return db
        .select({
            id: passkey.id,
            name: passkey.name,
            deviceType: passkey.deviceType,
            createdAt: passkey.createdAt
        })
        .from(passkey)
        .where(eq(passkey.userId, userId))
        .orderBy(desc(passkey.createdAt));
}
