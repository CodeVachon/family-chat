import { getCookieCache } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth/approval routing. This is NOT the security boundary — the DAL
 * (requireApprovedUser) is. Proxy only reads the cached session cookie to avoid
 * UI flashes and pre-filter obvious redirects. It runs on the Node.js runtime.
 */

const AUTH_ROUTES = ["/login", "/signup"];
const PENDING_ROUTE = "/pending";

type CachedSession = {
    user?: { approvalStatus?: string };
} | null;

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const session = (await getCookieCache(request)) as CachedSession;
    const isAuthed = Boolean(session?.user);
    const isApproved = session?.user?.approvalStatus === "approved";

    const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
    const isPendingRoute = pathname.startsWith(PENDING_ROUTE);

    // Unauthenticated: allow auth routes, redirect everything else to /login.
    if (!isAuthed) {
        if (isAuthRoute) return NextResponse.next();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    // Authenticated but not approved: keep them on /pending.
    if (!isApproved) {
        if (isPendingRoute) return NextResponse.next();
        const url = request.nextUrl.clone();
        url.pathname = PENDING_ROUTE;
        return NextResponse.redirect(url);
    }

    // Approved: keep them out of auth/pending screens.
    if (isAuthRoute || isPendingRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    // Run on everything except API routes, Next internals, and static assets.
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)"]
};
