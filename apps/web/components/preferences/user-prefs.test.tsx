import { afterEach, describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { SystemMessageRow } from "@/components/channels/system-message-row";
import { Timestamp, UserPrefsProvider } from "@/components/preferences/user-prefs";
import type { ChannelMessage } from "@/lib/queries/channels";
import type { ResolvedPreferences } from "@/lib/queries/preferences";

const prefs: ResolvedPreferences = {
    displayName: null,
    dateTimeFormat: "24h",
    themePreference: "system",
    notificationLevel: "mentions",
    colorHue: 220,
    fontSizeScale: "default",
    fontFamily: "figtree",
    avatarUrl: null,
    avatarSourceUrl: null,
    avatarCrop: null,
    bio: null,
    phone: null,
    bannerUrl: null,
    bannerSourceUrl: null,
    bannerCrop: null
};

// 00:32 UTC is 20:32 the previous evening for a US Eastern (EDT) viewer.
const instant = new Date("2026-07-21T00:32:00Z");

const originalTz = process.env.TZ;
afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
});

describe("Timestamp", () => {
    test("server render (UTC) does not bake the server's wall-clock time into the HTML", () => {
        process.env.TZ = "UTC";
        const html = renderToString(
            <UserPrefsProvider prefs={prefs}>
                <Timestamp date={instant} />
            </UserPrefsProvider>
        );
        expect(html).not.toContain("00:32");
    });

    test("a join system message does not show the server's time when server-rendered", () => {
        process.env.TZ = "UTC";
        const message = {
            id: "m1",
            type: "system",
            createdAt: instant,
            systemEvent: { event: "join", actorUserId: "u1", subjectUserId: "u1" },
            author: { id: "u1", name: "Sam", preferences: null }
        } as unknown as ChannelMessage;
        const html = renderToString(
            <UserPrefsProvider prefs={prefs}>
                <SystemMessageRow message={message} />
            </UserPrefsProvider>
        );
        expect(html).toContain("joined the channel");
        expect(html).not.toContain("00:32");
    });
});
