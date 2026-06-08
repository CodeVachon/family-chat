import { config } from "dotenv";
import type { NextConfig } from "next";

// Single source of truth for env lives at the monorepo root. Next only
// auto-loads from the app dir, so load the root .env here (dev/build/start).
config({ path: "../../.env" });

const nextConfig: NextConfig = {
    transpilePackages: ["@workspace/ui", "@workspace/db"],
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
