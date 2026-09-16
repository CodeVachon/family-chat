import { mock } from "bun:test";

import { auth } from "./mocks/auth";
import { getBroker } from "./mocks/broker";
import { isCloudinaryConfigured, isValidAttachmentUrl, signUpload } from "./mocks/cloudinary";
import { bootstrapFirstRun, joinDefaultChannels } from "./mocks/default-channels";
import { db } from "./mocks/db";
import { ensureMessageLinkPreviews } from "./mocks/link-preview";
import { pushForNewMessage } from "./mocks/push-notify";
import { createRealtimeStream } from "./mocks/realtime-stream";
import { insertSystemMessage } from "./mocks/system-messages";

// Runs before any test file is imported (see bunfig.toml `[test] preload`),
// so these mocks are in place before the service modules under test load —
// otherwise their real implementations (a live Postgres connection, a full
// betterAuth() instance, `server-only`'s hard throw outside Next's bundler)
// would evaluate first and blow up.
mock.module("server-only", () => ({}));
mock.module("@workspace/db/client", () => ({ db, sql: {} }));
mock.module("@/lib/auth", () => ({ auth }));
mock.module("@/lib/channels/default-channels", () => ({ joinDefaultChannels, bootstrapFirstRun }));
mock.module("@/lib/messaging/system-messages", () => ({ insertSystemMessage }));
// Only reachable from lib/api/v1.ts (and nothing with its own test suite), so
// mocking them here doesn't risk any other test's real-implementation coverage.
mock.module("@/lib/realtime/broker", () => ({ getBroker }));
mock.module("@/lib/realtime/stream", () => ({ createRealtimeStream }));
mock.module("@/lib/push/notify", () => ({ pushForNewMessage }));
mock.module("@/lib/messaging/link-preview", () => ({ ensureMessageLinkPreviews }));
mock.module("@/lib/cloudinary/server", () => ({
    isCloudinaryConfigured,
    isValidAttachmentUrl,
    signUpload
}));
