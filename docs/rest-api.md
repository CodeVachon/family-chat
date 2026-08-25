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
