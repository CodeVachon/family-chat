import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { passkey } from "@workspace/db/schema";

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
