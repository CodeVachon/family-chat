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

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const hasSession = Boolean(getSessionCookie(request));
    const cached = (await getCookieCache(request)) as CachedSession;
    const approvalKnown = Boolean(cached?.user);
    const isApproved = cached?.user?.approvalStatus === "approved";

    const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
    const isPendingRoute = pathname.startsWith(PENDING_ROUTE);

    // Not logged in: allow auth routes, redirect everything else to /login.
    if (!hasSession) {
        if (isAuthRoute) return NextResponse.next();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    // Logged in — keep them off the auth screens.
    if (isAuthRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
    }

    // Optimistic approval routing — only act when the cache tells us definitively.
    // When the cache has lapsed, let the request through; the DAL gates approval.
    if (approvalKnown && !isApproved && !isPendingRoute) {
        const url = request.nextUrl.clone();
        url.pathname = PENDING_ROUTE;
        return NextResponse.redirect(url);
    }
    if (approvalKnown && isApproved && isPendingRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    // Run on everything except API routes, Next internals, PWA assets (manifest,
    // service worker, icon — must be publicly fetchable for install), and static files.
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)"
    ]
};
