import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./sentry.server.config");
        // Only the Node.js server runtime runs the realtime broker. Node-only
        // code lives in a separate module so it never enters the Edge bundle.
        // Imported after Sentry so broker startup errors are captured.
        await import("@/lib/realtime/start-broker");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
    }
}

// Forwards nested React Server Component errors to Sentry.
export const onRequestError = Sentry.captureRequestError;
