# REST API

The versioned API is mounted at `/api/v1`. It uses the existing Better Auth
server at `/api/auth`; browser clients can use its session cookie, while native
clients can send the bearer token issued by the Better Auth bearer plugin:

```http
Authorization: Bearer <token>
```

All responses are JSON. Failed requests use `{ "error": { "message": "..." } }`;
invalid input additionally includes `issues` and returns `422`.

## Resources

- `GET /me`, `GET /preferences`, `PATCH /preferences/{profile,avatar,banner,appearance,notifications}`
- `GET /settings`, `GET /vapid-public-key`, `GET /unread`, `GET /activity`
- `GET|POST /channels`, `GET|PATCH|DELETE /channels/:channelId`
- `POST /channels/:channelId/{join,leave,read,typing}` and `PATCH /channels/:channelId/{favorite,archive}`
- `GET /channels/:channelId/{members,addable-users,images,messages}`
- `POST /channels/:channelId/{members,messages}`
- `PATCH|DELETE /channels/:channelId/members/:userId`
- `GET /channels/:channelId/messages/:messageId/thread`
- `PATCH|DELETE /messages/:messageId`, `PUT|DELETE /messages/:messageId/reactions/:emoji`
- `GET /users/:userId/profile`, `POST|DELETE /push-subscriptions`, `POST /uploads/sign`
- `GET|POST /admin/users`, `PATCH /admin/users/:userId`, `PATCH /admin/settings`
- `GET /stream` for the authenticated Server-Sent Event feed.

The API applies the same approval gates, channel membership checks, and role
permissions as the web application. Better Auth owns sign-up, sign-in,
password, verification, magic-link, and passkey endpoints under `/api/auth`.

## Idempotent message sends

`POST /channels/:channelId/messages` accepts an optional client-generated
`clientMessageId` (a UUID) in the request body:

```jsonc
{ "body": "<p>Dinner's at 6</p>", "clientMessageId": "b6e2...-...-..." }
```

Generate a fresh one per compose attempt (not per keystroke or per logical
message) and retry with the **same** `clientMessageId` if a send's outcome is
ambiguous (e.g. the connection dropped before a response arrived). The
server keys replay detection on `(authorUserId, clientMessageId)`:

- **First time seen**: the message is created normally.
- **Replay** (same author, same `clientMessageId`, same `channelId` as
  before): the original message is returned again, with the same `201`
  status — no duplicate is created, no push/SSE fan-out fires a second time.
  The response is **not** re-validated against the new request's body; only
  identity is checked, so a replay of the exact same retried request always
  gets the exact same answer.
- **Conflict** (same author, same `clientMessageId`, but a *different*
  `channelId`): **409** — reusing a client id across channels is a client
  bug, not a legitimate replay, and silently accepting it would post to the
  wrong channel or silently drop the new one.
- **Expiry**: none. The key is tied to the message row for as long as that
  row exists (including after a soft delete) — there is no TTL to reason
  about, and no cleanup job to keep running.
- Omitting `clientMessageId` entirely opts out — the request is never
  deduplicated, matching the previous (pre-idempotency) behavior. This is
  what the web app's own composer does; its server action has no
  cross-request retry to de-dupe in the first place.

Until a client sends `clientMessageId`, it must not automatically retry an
ambiguously-completed send — a retried request with no `clientMessageId`
creates a genuine duplicate message.
