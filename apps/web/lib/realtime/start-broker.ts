import "server-only";

import { getBroker } from "./broker";

// Node-only side-effect module: imported by instrumentation.ts solely on the
// Node.js runtime. Keeping `process.*` out of instrumentation.ts avoids the
// Edge-runtime static analysis error.

const broker = getBroker();

void broker.start().catch((err) => {
    console.error("[realtime] broker failed to start", err);
});

const shutdown = () => {
    void broker.shutdown();
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
