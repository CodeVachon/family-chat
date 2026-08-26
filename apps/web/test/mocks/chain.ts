import { mock } from "bun:test";

const CHAIN_METHODS = [
    "values",
    "from",
    "where",
    "set",
    "returning",
    "onConflictDoNothing",
    "onConflictDoUpdate",
    "orderBy",
    "limit",
    "groupBy",
    "having"
] as const;

type Chain = Promise<unknown> & Record<(typeof CHAIN_METHODS)[number], ReturnType<typeof mock>>;

/**
 * Stand-in for drizzle's chainable insert/update/delete/select builders
 * (`db.insert(t).values(...).returning(...)`, etc). Every chain method just
 * returns the same object, and the object resolves `value` when awaited —
 * enough to exercise service logic without a real database connection.
 */
export function chain(value: unknown = []): Chain {
    const obj = {
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(value).then(onFulfilled, onRejected),
        catch: (onRejected: (e: unknown) => unknown) => Promise.resolve(value).catch(onRejected)
    } as Chain;
    for (const method of CHAIN_METHODS) {
        obj[method] = mock(() => obj);
    }
    return obj;
}
