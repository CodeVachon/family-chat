import os from "node:os";
import path from "node:path";

import { withSentryConfig } from "@sentry/nextjs";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Single source of truth for env lives at the monorepo root. Next only
// auto-loads from the app dir, so load the root .env here (dev/build/start).
config({ path: "../../.env" });

// Allow cross-origin dev requests (HMR, server actions, /_next/*) from other
// devices like a phone — via the LAN IP (DEV_LAN_ORIGIN) and every variant of
// this machine's hostname a browser might send (bare name, `.local` Bonjour
// name iOS uses, full hostname), all lowercased since hosts are case-insensitive.
const fullHost = os.hostname().toLowerCase(); // e.g. "artimis.lan"
const baseHost = fullHost.split(".")[0] ?? fullHost; // e.g. "artimis"
const allowedDevOrigins = [
    ...new Set([
        ...(process.env.DEV_LAN_ORIGIN ? [new URL(process.env.DEV_LAN_ORIGIN).hostname] : []),
        fullHost,
        baseHost,
        `${baseHost}.local`
    ])
];

const nextConfig: NextConfig = {
    // Self-contained server build for Docker: traces just the files the server
    // needs into .next/standalone, so the runtime image carries no full
    // node_modules. The tracing root spans the whole monorepo so workspace
    // packages (@workspace/*) are included.
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, "../../"),
    transpilePackages: ["@workspace/ui", "@workspace/db"],
    allowedDevOrigins,
    // Keep server-only libs out of the bundler. Better-Auth ships optional
    // adapters (kysely) we don't use; bundling them trips static export checks.
    serverExternalPackages: [
        "better-auth",
        "@better-auth/kysely-adapter",
        "kysely",
        "postgres",
        "cloudinary",
        "open-graph-scraper",
        "undici",
        "web-push"
    ],
    experimental: {
        // Enables forbidden()/unauthorized() + forbidden.tsx/unauthorized.tsx
        authInterrupts: true
    },
    images: {
        remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }]
    },
    async headers() {
        return [
            {
                // SSE must not be buffered by reverse proxies (nginx etc.)
                source: "/api/stream",
                headers: [{ key: "X-Accel-Buffering", value: "no" }]
            }
        ];
    }
};

export default withSentryConfig(nextConfig, {
    // org/project drive source-map upload. Read from the environment so the
    // repo carries no hardcoded account details; when unset (or without a
    // SENTRY_AUTH_TOKEN) the upload step simply no-ops.
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Only print source-map upload logs in CI.
    silent: !process.env.CI,

    // Upload a wider set of source maps for nicer stack traces.
    widenClientFileUpload: true,

    // Proxy browser->Sentry requests through this route to dodge ad-blockers.
    // NOTE: kept out of the proxy middleware matcher (see proxy.ts) so the
    // tunnel isn't redirected through auth.
    tunnelRoute: "/monitoring",

    webpack: {
        // Auto-instrument Vercel Cron Monitors (no-op off Vercel).
        automaticVercelMonitors: true,
        treeshake: {
            // Drop Sentry's own debug logging from the bundle.
            removeDebugLogging: true
        }
    }
});
