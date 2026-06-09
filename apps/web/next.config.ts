import os from "node:os";
import path from "node:path";

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

export default nextConfig;
