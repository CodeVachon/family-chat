import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@workspace/db/client";
import { attachments, channelMembers, channels, messages, user } from "@workspace/db/schema";

export type ProfileChannel = {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
};

export type ProfileFile = {
    id: string;
    kind: string;
    secureUrl: string;
    originalFilename: string | null;
    createdAt: Date;
};

export type UserProfile = {
    userId: string;
    name: string;
    colorHue: number;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    phone: string | null;
    channels: ProfileChannel[];
    files: ProfileFile[];
};

const MAX_PROFILE_FILES = 24;

/**
 * A user's public profile for the side panel: identity + the public,
 * non-archived channels they belong to and the files they've uploaded in those
 * channels. Only public channels are surfaced, so this never reveals private
 * channel membership or content to a viewer who isn't in those channels.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const row = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { id: true, name: true },
        with: {
            preferences: {
                columns: {
                    displayName: true,
                    colorHue: true,
                    avatarUrl: true,
                    bannerUrl: true,
                    bio: true,
                    phone: true
                }
            }
        }
    });
    if (!row) return null;

    const publicChannel = and(eq(channels.isPrivate, false), eq(channels.isArchived, false));

    const [channelRows, fileRows] = await Promise.all([
        db
            .select({
                id: channels.id,
                name: channels.name,
                icon: channels.icon,
                color: channels.color
            })
            .from(channelMembers)
            .innerJoin(channels, eq(channels.id, channelMembers.channelId))
            .where(and(eq(channelMembers.userId, userId), publicChannel))
            .orderBy(asc(channels.name)),
        db
            .select({
                id: attachments.id,
                kind: attachments.kind,
                secureUrl: attachments.secureUrl,
                originalFilename: attachments.originalFilename,
                createdAt: attachments.createdAt
            })
            .from(attachments)
            .innerJoin(messages, eq(messages.id, attachments.messageId))
            .innerJoin(channels, eq(channels.id, messages.channelId))
            .where(
                and(eq(attachments.uploaderId, userId), isNull(messages.deletedAt), publicChannel)
            )
            .orderBy(desc(attachments.createdAt))
            .limit(MAX_PROFILE_FILES)
    ]);

    return {
        userId: row.id,
        name: row.preferences?.displayName ?? row.name,
        colorHue: row.preferences?.colorHue ?? 220,
        avatarUrl: row.preferences?.avatarUrl ?? null,
        bannerUrl: row.preferences?.bannerUrl ?? null,
        bio: row.preferences?.bio ?? null,
        phone: row.preferences?.phone ?? null,
        channels: channelRows,
        files: fileRows
    };
}
