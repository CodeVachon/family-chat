// Sentry initialization for the Node.js server runtime. Loaded from
// instrumentation.ts's register() hook. The DSN is read from the environment
// so the build/image carries no instance-specific config; when it's unset
// Sentry.init is a safe no-op and error reporting is simply disabled.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Sample 10% of traces in production (full volume in dev for debugging).
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

    // Send logs to Sentry.
    enableLogs: true,

    // Don't attach user PII (IP, request headers, etc.). This is a private
    // family chat — keep request metadata out of the error backend.
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: false
});
