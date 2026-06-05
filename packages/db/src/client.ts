import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}

// Reuse a single postgres.js client across HMR reloads in development so we
// don't exhaust connections. The dedicated LISTEN/NOTIFY connection used by the
// realtime broker is created separately (see apps/web/lib/realtime).
const globalForDb = globalThis as unknown as {
    __familyChatSql?: ReturnType<typeof postgres>;
};

const client = globalForDb.__familyChatSql ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
    globalForDb.__familyChatSql = client;
}

export const db = drizzle(client, { schema });

export { client as sql };

export type Database = typeof db;
