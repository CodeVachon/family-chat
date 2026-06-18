import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@workspace/db/client";
import { appSettings, user as userTable, userPreferences } from "@workspace/db/schema";

import { dailyDigestEmail, sendEmail } from "@/lib/email";
import { listUnreadForDigest } from "@/lib/queries/channels";

// Reads the DB and sends mail; never statically optimized.
export const dynamic = "force-dynamic";

/** The user's local hour (0–23) and date (YYYY-MM-DD) in a given IANA zone. */
function localParts(timezone: string, now: Date): { hour: number; date: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23"
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return {
        hour: Number.parseInt(get("hour"), 10),
        date: `${get("year")}-${get("month")}-${get("day")}`
    };
}

/**
 * Hourly cron: emails opted-in users an unread digest at their local midnight.
 * Run at the top of every hour by an external scheduler (see the Dockerfile) —
 * the right users are picked by computing each one's local hour. Idempotent via
 * `lastDigestSentOn` (the user's local date), so a second run within the hour
 * doesn't double-send. Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recipients = await db
        .select({
            userId: userPreferences.userId,
            timezone: userPreferences.timezone,
            lastDigestSentOn: userPreferences.lastDigestSentOn,
            displayName: userPreferences.displayName,
            email: userTable.email,
            name: userTable.name
        })
        .from(userPreferences)
        .innerJoin(userTable, eq(userTable.id, userPreferences.userId))
        .where(
            and(
                eq(userPreferences.dailyDigestEnabled, true),
                isNotNull(userPreferences.timezone),
                eq(userTable.approvalStatus, "approved")
            )
        );

    const appRow = await db.query.appSettings.findFirst({ where: eq(appSettings.id, "app") });
    const appName = appRow?.name ?? "Family Chat";
    const appUrl = process.env.BETTER_AUTH_URL ?? "";

    const now = new Date();
    let sent = 0;

    for (const r of recipients) {
        const { hour, date } = localParts(r.timezone!, now);
        // Only at the recipient's local midnight, and at most once per local day.
        if (hour !== 0 || r.lastDigestSentOn === date) continue;

        const channels = await listUnreadForDigest(r.userId);
        if (channels.length === 0) continue; // no empty digests

        const { subject, html } = dailyDigestEmail(
            appName,
            r.displayName ?? r.name,
            channels,
            appUrl
        );
        await sendEmail({ to: r.email, subject, html, fromName: appName });
        await db
            .update(userPreferences)
            .set({ lastDigestSentOn: date })
            .where(eq(userPreferences.userId, r.userId));
        sent += 1;
    }

    return NextResponse.json({ checked: recipients.length, sent });
}
