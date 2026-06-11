// Sentry initialization for the Edge runtime (middleware, edge routes). Loaded
// from instrumentation.ts's register() hook. As with the server config, the
// DSN comes from the environment and an unset DSN disables reporting.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Sample 10% of traces in production (full volume in dev for debugging).
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

    // Send logs to Sentry.
    enableLogs: true,

    // Don't attach user PII (IP, request headers, etc.) — private family chat.
    sendDefaultPii: false
});
