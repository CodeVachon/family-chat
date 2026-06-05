export async function register() {
    // Only the Node.js server runtime runs the realtime broker. Node-only code
    // lives in a separate module so it never enters the Edge bundle.
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    await import("@/lib/realtime/start-broker");
}
