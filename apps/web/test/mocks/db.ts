import { mock } from "bun:test";

import { chain } from "./chain";

type QueryTable = "channelMembers" | "channels" | "user" | "messages" | "appSettings";
const QUERY_TABLES: QueryTable[] = [
    "channelMembers",
    "channels",
    "user",
    "messages",
    "appSettings"
];

function makeQueryTable() {
    return {
        findFirst: mock(async () => undefined as unknown),
        findMany: mock(async () => [] as unknown[])
    };
}

/**
 * Fake `db` handle standing in for `@workspace/db/client`'s `db`, wired up via
 * the `server-only`/`@workspace/db/client` mocks in test/preload.ts so
 * services can be imported and exercised without a real Postgres connection.
 * `transaction` invokes its callback with this same object, so mocking
 * `db.insert`/`db.delete`/etc. also covers calls made through `tx`.
 */
export const db = {
    query: Object.fromEntries(QUERY_TABLES.map((t) => [t, makeQueryTable()])) as Record<
        QueryTable,
        ReturnType<typeof makeQueryTable>
    >,
    insert: mock(() => chain([])),
    update: mock(() => chain(undefined)),
    delete: mock(() => chain([])),
    select: mock(() => chain([])),
    transaction: mock(async (cb: (tx: typeof db) => unknown) => cb(db))
};

/** Reset every db mock to its default (empty) behavior between tests. */
export function resetDb() {
    for (const table of QUERY_TABLES) {
        db.query[table].findFirst.mockReset().mockImplementation(async () => undefined);
        db.query[table].findMany.mockReset().mockImplementation(async () => []);
    }

    db.insert.mockReset().mockImplementation(() => chain([]));
    db.update.mockReset().mockImplementation(() => chain(undefined));
    db.delete.mockReset().mockImplementation(() => chain([]));
    db.select.mockReset().mockImplementation(() => chain([]));
    db.transaction.mockReset().mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
}
