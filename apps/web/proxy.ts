import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth/approval routing. This is NOT the security boundary — the DAL
 * (requireApprovedUser) is. It runs on the Node.js runtime.
 *
 * Login is detected by the long-lived session token cookie; the short-lived
 * cookie cache is used only for the optimistic approval redirect (and may be
 * absent once it lapses, in which case the DAL enforces approval authoritatively).
 */

const AUTH_ROUTES = ["/login", "/signup"];
const PENDING_ROUTE = "/pending";

type CachedSession = {
    user?: { approvalStatus?: string };
} | null;

/**
 * Build a strict, nonce-based Content-Security-Policy. `'strict-dynamic'` makes
 * the policy trust only the nonce'd bootstrap script (and what it loads), so a
 * DOMPurify bypass that smuggles a <script> or inline handler through
 * `message-body`'s dangerouslySetInnerHTML still can't execute. Styles fall back
 * to 'unsafe-inline' (Tailwind + inline style attrs can't be nonced practically);
 * Cloudinary is allowed for image/media delivery + signed uploads; the Sentry
 * replay/monitoring tunnel is same-origin (`tunnelRoute: "/monitoring"`) so
 * 'self' covers it. Dev adds 'unsafe-eval' (React Refresh) and ws: (HMR).
 */
function buildCsp(nonce: string): string {
    const isProd = process.env.NODE_ENV === "production";
    return [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
        `style-src 'self' 'unsafe-inline'`,
        // Any https image: link-preview thumbnails + favicons come from arbitrary
        // third-party hosts. Images can't execute script, so this is safe while
        // script-src stays strict.
        `img-src 'self' blob: data: https:`,
        `media-src 'self' blob: https://res.cloudinary.com`,
        `font-src 'self' data:`,
        `connect-src 'self' https://api.cloudinary.com${isProd ? "" : " ws: wss:"}`,
        `worker-src 'self' blob:`,
        `manifest-src 'self'`,
        `frame-src 'none'`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
        ...(isProd ? ["upgrade-insecure-requests"] : [])
    ].join("; ");
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Per-request CSP nonce. Forwarding it on the request lets Next inject it into
    // its own inline bootstrap script and re-expose it via `x-nonce`, which the
    // root layout reads to nonce next-themes' inline theme script.
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = buildCsp(nonce);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);

    const withCsp = (response: NextResponse): NextResponse => {
        response.headers.set("content-security-policy", csp);
        return response;
    };
    const next = () => withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
    const redirectTo = (to: string) => {
        const url = request.nextUrl.clone();
        url.pathname = to;
        return withCsp(NextResponse.redirect(url));
    };

    const hasSession = Boolean(getSessionCookie(request));
    const cached = (await getCookieCache(request)) as CachedSession;
    const approvalKnown = Boolean(cached?.user);
    const isApproved = cached?.user?.approvalStatus === "approved";

    const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
    const isPendingRoute = pathname.startsWith(PENDING_ROUTE);

    // Not logged in: allow auth routes, redirect everything else to /login.
    if (!hasSession) {
        if (isAuthRoute) return next();
        return redirectTo("/login");
    }

    // Logged in — keep them off the auth screens, but only when we have a cached
    // session to trust. A bare session-token cookie with no (or lapsed) cookie
    // cache can be stale — e.g. the session was purged server-side (DB reset,
    // sign-out elsewhere) or expired. Bouncing it to "/" traps the user in a
    // /login -> / -> /login loop (ERR_TOO_MANY_REDIRECTS): the DAL then rejects
    // the session and redirects back here, and being an RSC it can't clear the
    // cookie. Letting them reach /login lets a fresh login overwrite it.
    if (isAuthRoute) return approvalKnown ? redirectTo("/") : next();

    // Optimistic approval routing — only act when the cache tells us definitively.
    // When the cache has lapsed, let the request through; the DAL gates approval.
    if (approvalKnown && !isApproved && !isPendingRoute) return redirectTo(PENDING_ROUTE);
    if (approvalKnown && isApproved && isPendingRoute) return redirectTo("/");

    return next();
}

export const config = {
    // Run on everything except API routes, the Sentry tunnel (/monitoring — must
    // not be redirected through auth), Next internals, PWA assets (manifest,
    // service worker, icon — must be publicly fetchable for install), and static files.
    matcher: [
        "/((?!api|monitoring|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)"
    ]
};
