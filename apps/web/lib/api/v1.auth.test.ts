import { beforeEach, describe, expect, it } from "bun:test";

import { request, resetAllMocks, signedInAs, uuid } from "../../test/helpers/api-v1";

/**
 * Cross-cutting auth guard for the versioned REST API (everything except
 * Better Auth's own routes, which live outside this file). Every route below
 * calls requireApiUser (directly or via channelRequest / messageRequest) as
 * its first step, before touching the body or the db — so a missing/invalid
 * session must 401 regardless of the route's own logic. Per-route
 * business-logic tests live in the sibling v1.*.test.ts files.
 */

beforeEach(resetAllMocks);

describe("authentication guard", () => {
    const PROTECTED_ROUTES: Array<[string, string]> = [
        ["GET", "/me"],
        ["GET", "/unread"],
        ["GET", "/stream"],
        ["GET", "/channels"],
        ["GET", "/activity"],
        ["POST", "/channels"],
        ["GET", "/channels/public"],
        ["GET", `/channels/${uuid()}`],
        ["PATCH", `/channels/${uuid()}`],
        ["PATCH", `/channels/${uuid()}/archive`],
        ["DELETE", `/channels/${uuid()}`],
        ["POST", `/channels/${uuid()}/join`],
        ["POST", `/channels/${uuid()}/leave`],
        ["PATCH", `/channels/${uuid()}/favorite`],
        ["POST", `/channels/${uuid()}/read`],
        ["POST", `/channels/${uuid()}/typing`],
        ["GET", `/channels/${uuid()}/members`],
        ["GET", `/channels/${uuid()}/addable-users`],
        ["POST", `/channels/${uuid()}/members`],
        ["PATCH", `/channels/${uuid()}/members/u1`],
        ["DELETE", `/channels/${uuid()}/members/u1`],
        ["GET", `/channels/${uuid()}/messages`],
        ["POST", `/channels/${uuid()}/messages`],
        ["GET", `/channels/${uuid()}/messages/${uuid()}/thread`],
        ["PATCH", `/messages/${uuid()}`],
        ["DELETE", `/messages/${uuid()}`],
        ["PUT", `/messages/${uuid()}/reactions/${encodeURIComponent("👍")}`],
        ["DELETE", `/messages/${uuid()}/reactions/${encodeURIComponent("👍")}`],
        ["GET", `/channels/${uuid()}/images`],
        ["GET", "/users/u1/profile"],
        ["GET", "/preferences"],
        ["PATCH", "/preferences/profile"],
        ["PATCH", "/preferences/avatar"],
        ["PATCH", "/preferences/banner"],
        ["PATCH", "/preferences/appearance"],
        ["PATCH", "/preferences/notifications"],
        ["POST", "/push-subscriptions"],
        ["DELETE", "/push-subscriptions"],
        ["POST", "/uploads/sign"],
        ["GET", "/admin/users"],
        ["POST", "/admin/users"],
        ["PATCH", "/admin/users/u1"],
        ["PATCH", "/admin/settings"]
    ];

    for (const [method, path] of PROTECTED_ROUTES) {
        it(`${method} ${path} returns 401 without a session`, async () => {
            const res = await request(method, path);
            expect(res.status).toBe(401);
        });
    }

    it("returns 403 when the session belongs to an unapproved user", async () => {
        signedInAs({ approvalStatus: "pending" });

        const res = await request("GET", "/me");

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.message).toBe("An approved account is required");
    });
});
