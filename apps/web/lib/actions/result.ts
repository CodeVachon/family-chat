import type { z } from "zod";

/**
 * The result of a server action that can fail on invalid user input.
 *
 * A server action must NOT *throw* on a validation failure. A thrown error is
 * forwarded to Sentry by `onRequestError` (see instrumentation.ts) as if it
 * were a real fault, and Next.js redacts its message to a generic string in
 * production — so the user never learns what was actually wrong. Returning the
 * failure as data avoids both: the client renders `error`, and Sentry stays
 * quiet. Unexpected faults (auth, DB, network) should still throw, so they
 * remain visible in Sentry.
 */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Validate `input` against `schema`, returning a structured failure (the first
 * issue's message) instead of throwing on invalid input. On success returns the
 * parsed data so the caller can proceed.
 */
export function parseInput<S extends z.ZodType>(
    schema: S,
    input: unknown
): ActionResult<z.infer<S>> {
    const result = schema.safeParse(input);
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, error: result.error.issues[0]?.message ?? "Invalid input" };
}
