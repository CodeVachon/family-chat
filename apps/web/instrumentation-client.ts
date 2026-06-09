// Sentry initialization for the browser. Runs whenever a user loads a page.
// The public DSN is read from NEXT_PUBLIC_SENTRY_DSN, which Next inlines at
// build time; when it's unset Sentry.init is a no-op (reporting disabled), so
// the default build/image ships without any instance-specific config.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Capture a slice of sessions for Session Replay.
    integrations: [Sentry.replayIntegration()],

    // Adjust in production, or use tracesSampler for finer control.
    tracesSampleRate: 1,

    // Send logs to Sentry.
    enableLogs: true,

    // Sample 10% of sessions, and 100% of sessions where an error occurs.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Send user PII (IP, etc.). See:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true
});

// Instruments client-side navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
