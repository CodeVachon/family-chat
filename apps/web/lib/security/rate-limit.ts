import "server-only";

/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Deliberately modest about what it is: the state lives in this process, so a
 * multi-instance deployment multiplies the effective allowance by the instance
 * count, and a restart clears it. That is acceptable for the job — stopping a
 * runaway or hostile client from turning one API call into fan-out across every
 * member's devices. It is not a quota system; if we ever need exact limits shared
 * across instances, that belongs in Redis or at the edge, not here.
 *
 * Generalized from the per-user/per-channel window in `app/api/typing/route.ts`,
 * which predates this and keeps its own copy because it needs a 204 rather than
 * an error.
 */

type Window = { hits: number[]; windowMs: number };

// Pinned to globalThis so Next's dev HMR doesn't hand out a fresh map on reload
// (which would silently reset everyone's budget on every code change).
const globalForRateLimit = globalThis as unknown as {
    __rateLimitWindows?: Map<string, Window>;
};
const windows = (globalForRateLimit.__rateLimitWindows ??= new Map<string, Window>());

/** Prune once the map exceeds this, so distinct keys can't grow it without bound. */
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitVerdict = {
    allowed: boolean;
    /** How long until a slot frees up. 0 when allowed. */
    retryAfterMs: number;
};

/** Drop keys whose most recent hit is already outside their own window. */
function pruneExpired(now: number): void {
    for (const [key, window] of windows) {
        const newest = window.hits[window.hits.length - 1];
        if (newest === undefined || now - newest >= window.windowMs) windows.delete(key);
    }
}

/**
 * Record a hit against `key` and report whether it is within budget.
 *
 * `now` is injectable so behavior is reasonable to exercise by hand; callers
 * should omit it.
 */
export function rateLimit(
    key: string,
    { limit, windowMs }: { limit: number; windowMs: number },
    now: number = Date.now()
): RateLimitVerdict {
    const cutoff = now - windowMs;
    const previous = windows.get(key);
    // Only hits still inside the window count toward the limit.
    const hits = previous ? previous.hits.filter((at) => at > cutoff) : [];

    if (hits.length >= limit) {
        // The oldest surviving hit is the one whose expiry frees the next slot.
        const oldest = hits[0]!;
        windows.set(key, { hits, windowMs });
        return { allowed: false, retryAfterMs: Math.max(0, oldest + windowMs - now) };
    }

    hits.push(now);
    windows.set(key, { hits, windowMs });
    if (windows.size > MAX_TRACKED_KEYS) pruneExpired(now);
    return { allowed: true, retryAfterMs: 0 };
}

/**
 * Posting budget per user, across all channels — a flood is a flood wherever it
 * lands. Sustained human posting is a few messages a minute, so this leaves
 * roughly an order of magnitude of headroom while still stopping a loop dead.
 *
 * Worth being clear about why messages get a limit when the other writes don't:
 * one `postMessage` fans out over SSE to every member, sends web push to every
 * 'all'-level member and everyone mentioned, and triggers an outbound fetch per
 * URL in the body. It is the one write that amplifies.
 */
export const MESSAGE_RATE_LIMIT = { limit: 20, windowMs: 60_000 } as const;
