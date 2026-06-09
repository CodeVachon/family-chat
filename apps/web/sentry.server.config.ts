// Sentry initialization for the Node.js server runtime. Loaded from
// instrumentation.ts's register() hook. The DSN is read from the environment
// so the build/image carries no instance-specific config; when it's unset
// Sentry.init is a safe no-op and error reporting is simply disabled.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Adjust in production, or use tracesSampler for finer control.
    tracesSampleRate: 1,

    // Send logs to Sentry.
    enableLogs: true,

    // Send user PII (IP, request headers, etc.). See:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true
});
