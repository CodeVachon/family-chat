export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe used by the Dockerfile HEALTHCHECK. Confirms the
 * Next server is actually serving (not just that the process is alive). No auth
 * and no DB access — `/api/*` is excluded from the proxy auth middleware, so
 * this returns 200 without a redirect.
 */
export function GET() {
    return new Response("ok", {
        status: 200,
        headers: { "Cache-Control": "no-store" }
    });
}
