/**
 * Single source of truth for the SSE event catalog. Kept in its own module
 * (rather than declared inline on `RealtimeEvent` in ./broker) so the
 * contract schema (lib/api/contract/schemas.ts) and docs/rest-api.md's event
 * table can both derive from it without importing ./broker itself, which is
 * wholesale-mocked in tests (it opens a real Postgres LISTEN connection).
 */
export const REALTIME_EVENT_TYPES = [
    "ready",
    "resync",
    "message.created",
    "message.updated",
    "message.deleted",
    "reaction.changed",
    "mention",
    "read.updated",
    "channels.changed",
    "users.changed",
    "settings.changed",
    "typing",
    "presence",
    "presence.snapshot"
] as const;
