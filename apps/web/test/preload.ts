import { mock } from "bun:test";

import { auth } from "./mocks/auth";
import { db } from "./mocks/db";
import { bootstrapFirstRun, joinDefaultChannels } from "./mocks/default-channels";
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
