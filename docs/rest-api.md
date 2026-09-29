# REST API

The versioned API is mounted at `/api/v1`. It uses the existing Better Auth
server at `/api/auth`; browser clients can use its session cookie, while native
clients can send the bearer token issued by the Better Auth bearer plugin:

```http
Authorization: Bearer <token>
```

Any response that would set a session cookie also echoes the raw session
token in a `set-auth-token` response header — a native client captures that
header once (from `POST /api/auth/sign-in/email`, magic-link verify, etc.)
and sends it back as the bearer token above. There is no separate refresh
token; a session is a sliding-expiry token (Better Auth defaults — not
overridden here). Log out with `POST /api/auth/sign-out` and discard the
local token.

This document is the contract's source of truth. **The machine-checked half
of it lives in code**, not here:

- [`apps/web/lib/api/contract/schemas.ts`](../apps/web/lib/api/contract/schemas.ts) —
  zod schemas for every response shape below.
- [`apps/web/lib/api/contract/fixtures.ts`](../apps/web/lib/api/contract/fixtures.ts) —
  example payloads satisfying those schemas; the code blocks below are copied
  from them.
- [`apps/web/lib/api/v1.contract.test.ts`](../apps/web/lib/api/v1.contract.test.ts) —
  parses both the fixtures and real route responses against the schemas.

If a route handler's actual response ever stops matching what's documented
here, that test fails. Nothing enforces the reverse (that this file stays in
sync with the fixtures) — update both together.

## Versioning

`/api/v1` has no formal deprecation policy yet because nothing has ever needed
to break it. Until one exists, treat the current, unversioned `/api/v1` as
stable under these rules:

- **Non-breaking** (no version bump needed): adding a new endpoint, adding an
  optional request field, adding a new response field, adding a new enum
  member to a field a client should already treat as open (e.g. a new SSE
  `type`, a new `channelRole`), loosening a validation constraint.
- **Breaking** (needs `/api/v2`, or a new endpoint if only one resource is
  affected): removing or renaming a response field, changing a field's type or
  meaning, tightening validation on a previously-accepted request shape,
  changing a status code a client would reasonably branch on, changing
  pagination strategy for an existing endpoint.
- A breaking change ships as a new path (`/api/v2/...` or a new endpoint), not
  an in-place change to `/api/v1` — this API has exactly one deployed consumer
  today (`family-chat-cli`), but the point of versioning it at all is to not
  need to know that.

## Error envelope

All `/api/v1/*` errors: `{ "error": { "message": "..." } }`.

```jsonc
// errorEnvelopeFixture
{ "error": { "message": "Channel not found" } }
```

Validation failures (Zod) additionally include `"issues"` (the raw
`ZodError.issues` array) and use **422** rather than 400:

```jsonc
// validationErrorEnvelopeFixture
{
  "error": {
    "message": "Validation failed",
    "issues": [{ "code": "custom", "message": "Message cannot be empty", "path": ["body"] }]
  }
}
```

| Status | Meaning |
|---|---|
| 400 | Malformed request the schema layer never saw (bad path param, bad query param) |
| 401 | No session |
| 403 | Session exists but isn't approved, or isn't authorized for this action |
| 404 | Resource not found |
| 409 | Conflicting state (e.g. modifying the channel owner) |
| 422 | Zod validation failure, or a semantically invalid but well-typed body |
| 429 | Rate limited (see below) |
| 500 | Unhandled error — server logs the real error; the client never sees it |

A `2xx` with an empty body is always **204**, never `200` with an empty JSON
object — `DELETE`, `join`/`leave`/`read`/`typing`, and the push-subscription
endpoints all respond this way.

## Rate limits

In-memory, per-process (not shared across instances — informational for
client-side backoff, not a hard guarantee):

| Action | Limit | Notes |
|---|---|---|
| `POST /channels/:id/messages` | 20 / 60s per user, across all channels | 429 with a human-readable `retryAfterMs`-derived message |
| `POST /channels/:id/typing` | 1 / 2.5s per (user, channel) | Silently no-ops (204), not an error |
| Better Auth magic-link request | 5 / 60s | Enforced inside the plugin, not app code |

**No idempotency key exists on `POST /messages` yet** (tracked separately) — a
retried request after a dropped response creates a duplicate message. Clients
must not automatically retry an ambiguous send; de-dupe client-side (e.g. an
optimistic local id reconciled against the SSE `message.created` echo)
instead.

## Encoding conventions

- All field names are `camelCase`.
- All timestamps are ISO-8601 strings (`Date#toJSON()`, e.g.
  `"2026-01-15T18:04:12.000Z"`) — never a bare date, never epoch millis. A
  nullable timestamp (e.g. `archivedAt`, `editedAt`) is `null`, not omitted.
- A field that can be absent for a *reason* (not yet set, not applicable) is
  `null` rather than omitted from the object — every documented field is
  always present on a successful response.
- Message `body` is **sanitized HTML** (the Tiptap rich-text pipeline's
  output), not plain text or Markdown. A terminal client needs an
  HTML→renderable-text conversion (strip tags, resolve `<span
  data-type="mention" data-id="...">` to a name, etc.) — see
  `apps/web/lib/messaging/rich-text.ts`'s `htmlToText` for the same reduction
  the server itself uses for previews/notifications.

## Resources

All require `Authorization: Bearer <token>` (or the browser session cookie)
unless marked **public**.

- `GET /health` — public, `{ ok: true }`.
- `GET /me` — `{ user, preferences, unread }`.
- `GET /settings` — public, app branding (`name`, `iconUrl`, `defaultChannelIds`).
- `GET /vapid-public-key` — public, web-push key.
- `GET /unread` — `{ total }`.
- `GET /activity` — recent-message previews per visible channel.
- `GET /stream` — the SSE feed (see below).
- `GET|POST /channels`, `GET /channels/public`, `GET|PATCH|DELETE /channels/:channelId`
- `POST /channels/:id/{join,leave,read,typing}`, `PATCH /channels/:id/{favorite,archive}`
- `GET /channels/:id/members`, `GET /channels/:id/addable-users`
- `POST /channels/:id/members`, `PATCH|DELETE /channels/:id/members/:userId`
- `GET /channels/:id/messages` (paginated, see below), `POST /channels/:id/messages`
- `GET /channels/:id/messages/:messageId/thread`
- `PATCH|DELETE /messages/:messageId`
- `PUT|DELETE /messages/:messageId/reactions/:emoji`
- `GET /channels/:id/images` (gallery, offset-paginated)
- `GET /users/:userId/profile`
- `GET|PATCH /preferences` (+ `/profile`, `/avatar`, `/banner`, `/appearance`, `/notifications` sub-resources)
- `POST|DELETE /push-subscriptions`, `POST /uploads/sign` — web-push/Cloudinary.
- `GET|POST /admin/users`, `PATCH /admin/users/:userId`, `PATCH /admin/settings` — admin-only.

The API applies the same approval gates, channel membership checks, and role
permissions as the web application. Better Auth owns sign-up, sign-in,
password, verification, magic-link, and passkey endpoints under `/api/auth`.

### `GET /me`

```jsonc
// meResponseFixture
{
  "user": {
    "id": "018f2e2a-0000-7000-8000-000000000001",
    "name": "Jamie Vachon",
    "email": "jamie@example.com",
    "emailVerified": true,
    "image": null,
    "appRole": "user",           // "owner" | "admin" | "user"
    "approvalStatus": "approved", // "approved" | "pending" | "rejected"
    "createdAt": "2026-01-15T18:04:12.000Z",
    "updatedAt": "2026-01-15T18:04:12.000Z"
  },
  "preferences": { /* see Preferences below */ },
  "unread": 3
}
```

A pending or rejected account authenticates fine (200 from `/api/auth/*`) but
gets **403** on every `/api/v1` resource until an admin approves it. The very
first user in an instance is auto-approved as `owner`.

### Channel shape

```jsonc
// channelFixture
{
  "id": "uuid", "name": "General", "description": "string|null",
  "color": "#3b82f6|null", "icon": "hash|null",
  "isPrivate": false, "isArchived": false, "archivedAt": null,
  "createdByUserId": "uuid", "createdAt": "ts", "updatedAt": "ts"
}
```

`GET /channels` and `GET /activity` return this shape *extended* with
`myRole` (`owner|admin|user|viewer|null`), `isFavorite`, `unreadCount`, and
`mentionCount` — that extended shape only exists on those two list endpoints.

`GET /channels/:id` returns the plain row plus separate `membership` (the raw
`channel_members` row, or `null` if not a member) and `capabilities`
(`canPost`, `canManage`, `canManageMembers`) fields — drive which actions a
client offers off `capabilities` rather than reimplementing the permission
matrix:

```jsonc
// channelDetailResponseFixture
{
  "channel": { /* channel shape above */ },
  "membership": {
    "id": "uuid", "channelId": "uuid", "userId": "uuid",
    "role": "user", "isFavorite": true,
    "lastReadMessageId": "uuid|null", "lastReadAt": "ts|null",
    "joinedAt": "ts", "createdAt": "ts", "updatedAt": "ts"
  },
  "capabilities": { "canPost": true, "canManage": false, "canManageMembers": false }
}
```

`GET /channels/:id/members` returns a third, flattened shape — display-ready,
not the raw membership row:

```jsonc
// channelMemberFixture
{ "userId": "uuid", "role": "user", "name": "Jamie", "colorHue": 220, "avatarUrl": null }
```

### Message shape — history vs. send response

**These are two different shapes.** `POST /channels/:id/messages` returns
just the raw inserted row:

```jsonc
// sendMessageResponseFixture — POST /channels/:id/messages
{
  "message": {
    "id": "uuid", "channelId": "uuid", "authorUserId": "uuid",
    "type": "user", "systemEvent": null, "threadRootId": null,
    "body": "<p>Dinner's at 6</p>",
    "editedAt": null, "deletedAt": null,
    "createdAt": "ts", "updatedAt": "ts"
  }
}
```

There is no `author`/`attachments`/`reactions`/`mentions` on that response —
the sender already knows what it sent and can render it optimistically, then
reconcile against the SSE `message.created` echo or the next history page.

`GET /channels/:id/messages` (and `.../thread`) return a **decorated** shape —
everything needed to render without a follow-up request:

```jsonc
// channelMessageFixture — a page item from GET /channels/:id/messages
{
  "id": "uuid", "channelId": "uuid", "authorUserId": "uuid",
  "type": "user", "systemEvent": null, "threadRootId": null,
  "body": "<p>Dinner's at 6</p>",
  "editedAt": null, "deletedAt": null,
  "createdAt": "ts", "updatedAt": "ts",
  "author": { "id": "uuid", "name": "Jamie Vachon", "preferences": { "displayName": "Jamie", "colorHue": 220, "avatarUrl": null } },
  "attachments": [ /* see below */ ],
  "reactions": [{ "emoji": "👍", "count": 2, "reactedByMe": true }],
  "mentions": [{ "userId": "uuid", "name": "Sam", "colorHue": 140 }],
  "mentionsMe": false,
  "linkPreviews": [],
  "replyCount": 2,
  "lastReplyAt": "ts|null"
}
```

`GET /channels/:id/messages/:messageId/thread` returns the same decorated
shape **without** `replyCount`/`lastReplyAt` (a reply doesn't have its own
thread aggregate) and with no pagination — the whole thread comes back in one
response.

`systemEvent` is non-null only when `type === "system"` (join/leave/
channel_updated announcements) — those messages are not editable, deletable,
or reactable.

Attachment shape (Cloudinary-backed):

```jsonc
// attachmentFixture
{
  "id": "uuid", "messageId": "uuid", "uploaderId": "uuid",
  "kind": "image", "provider": "cloudinary", "publicId": "family-chat/.../abc123",
  "resourceType": "image", "secureUrl": "https://res.cloudinary.com/...",
  "format": "jpg", "bytes": 245760, "width": 1600, "height": 1200,
  "originalFilename": "beach-day.jpg", "thumbnailUrl": null, "createdAt": "ts"
}
```

### Preferences

```jsonc
{
  "displayName": "Jamie", "dateTimeFormat": "relative", // "relative"|"12h"|"24h"
  "themePreference": "system",                          // "system"|"light"|"dark"
  "notificationLevel": "mentions",                       // "all"|"mentions"|"none"
  "colorHue": 220,
  "fontSizeScale": "default",                            // "small"|"default"|"large"|"xlarge"
  "fontFamily": "figtree",
  "avatarUrl": null, "avatarSourceUrl": null, "avatarCrop": null,
  "bio": null, "phone": null,
  "bannerUrl": null, "bannerSourceUrl": null, "bannerCrop": null
}
```

`PATCH /preferences/{profile,avatar,banner,appearance,notifications}` each
write only their own field subset (see `apps/web/lib/validation/preferences.ts`
for the exact required/optional fields per sub-resource) and return the full,
re-resolved preferences object above.

### Pagination

Three different strategies, deliberately, per resource:

- **Messages** (`GET /channels/:id/messages`): **keyset/cursor**, newest page
  first. Query params `beforeId` + `beforeCreatedAt` (both required together)
  page backwards. Page size fixed at **50**. Response: `{ messages, hasMore }`
  — `hasMore` is `messages.length >= 50`, an approximation rather than an
  exact count.
- **Gallery images** (`GET /channels/:id/images`): **offset**-based
  (`?offset=`), page size **60**, ascending/oldest-first. Response includes
  `hasMore` and an exact `total` count.
- **Thread replies** (`GET /channels/:id/messages/:messageId/thread`): no
  pagination — the whole thread returns in one response.

### Real-time transport: SSE

`GET /api/v1/stream`, authenticated the same way as everything else. Backed by
Postgres `LISTEN/NOTIFY` fanned out from a single in-process broker (so it's
per-instance).

- Sends an SSE `retry: 3000` directive immediately, then a `ready` event once
  subscribed, then a `heartbeat` comment every 25s (keeps proxies from closing
  the connection).
- Connection caps: 10 concurrent per user, 1000 total server-wide; over-cap
  returns `429 Too many concurrent connections` instead of opening the
  stream.
- No server-side auto-reconnect beyond the `retry:` hint — that's an
  HTTP-client-library concern.

Event catalog (the type union in
[`apps/web/lib/realtime/event-types.ts`](../apps/web/lib/realtime/event-types.ts),
which the contract schema imports directly — this list cannot drift from what
the broker actually sends):

| `type` | Fields carried | Meaning |
|---|---|---|
| `ready` | `ts` | Stream is subscribed and live |
| `resync` | `ts` | Broker reconnected to Postgres — re-pull anything you're tracking (unread counts, visible channels), don't tear down the stream |
| `message.created` / `.updated` / `.deleted` | `channelId`, `messageId`, `ts` | Re-fetch or patch the message locally |
| `reaction.changed` | `channelId`, `messageId`, `ts` | Re-fetch the message's reaction summary |
| `mention` | `channelId`, `messageId`, `targetUserId`, `ts` | You were mentioned |
| `read.updated` | `channelId`, `userId`, `ts` | A member's read pointer moved (unread badge updates) |
| `channels.changed` | `ts` | Visible-channel set changed — refetch `GET /channels` |
| `users.changed` | `ts` | User directory changed (new signup, approval, role change) |
| `settings.changed` | `ts` | App settings changed — refetch `GET /settings` |
| `typing` | `channelId`, `userId`, `name`, `ts` | Someone is typing |
| `presence` | `userId`, `online`, `ts` | A user's online status changed |
| `presence.snapshot` | `onlineUserIds`, `ts` | Sent once on subscribe: everyone currently online |

```jsonc
// realtimeEventFixtures.messageCreated
{ "type": "message.created", "channelId": "uuid", "messageId": "uuid", "ts": 1700000000001 }
```
