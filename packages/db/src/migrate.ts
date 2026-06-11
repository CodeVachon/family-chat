import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// Load the repo-root .env for local/CI runs (mirrors drizzle.config.ts). In the
// container the file is absent and config is supplied via the process
// environment, so this is a harmless no-op — and existing env vars always win.
config({ path: path.join(scriptDir, "..", "..", "..", ".env") });

// Applies any pending Drizzle migrations and exits. This is the single source
// of truth for "deploy the schema" — run it locally/in CI via `bun run
// db:deploy`, and it's the same code the production container runs on startup
// (see the Dockerfile entrypoint). It uses the runtime `drizzle-orm` migrator
// rather than `drizzle-kit`, so it needs no devDependencies and works inside
// the slim standalone image.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}

// The compiled SQL + meta/_journal.json live in the package's `drizzle` folder.
// Resolve it relative to this file by default so it works whether run from
// source (packages/db/src) or as a bundle; allow an override for the container,
// where the folder is copied to a fixed path beside the bundled script.
const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.join(scriptDir, "..", "drizzle");

// A single dedicated connection — migrations are sequential and we take a
// session-level advisory lock on it so concurrent container starts can't run
// migrations against the same database at the same time.
const sql = postgres(connectionString, { max: 1 });

// Arbitrary but fixed app-wide key for the migration lock.
const MIGRATION_LOCK_KEY = 8473625190;

async function main() {
    const db = drizzle(sql);

    console.log("[migrate] acquiring advisory lock…");
    await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`;

    try {
        console.log(`[migrate] applying migrations from ${migrationsFolder}`);
        await migrate(db, { migrationsFolder });
        console.log("[migrate] up to date");
    } finally {
        await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    }
}

main()
    .then(async () => {
        await sql.end();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error("[migrate] failed:", err);
        await sql.end({ timeout: 5 }).catch(() => {});
        process.exit(1);
    });
