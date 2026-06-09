// Sentry initialization for the Edge runtime (middleware, edge routes). Loaded
// from instrumentation.ts's register() hook. As with the server config, the
// DSN comes from the environment and an unset DSN disables reporting.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Adjust in production, or use tracesSampler for finer control.
    tracesSampleRate: 1,

    // Send logs to Sentry.
    enableLogs: true,

    // Send user PII (IP, request headers, etc.).
    sendDefaultPii: true
});
