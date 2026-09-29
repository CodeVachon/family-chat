import { auth, resetAuth } from "../mocks/auth";
import { resetBroker } from "../mocks/broker";
import { resetCloudinary } from "../mocks/cloudinary";
import { resetDb } from "../mocks/db";
import { resetDefaultChannels } from "../mocks/default-channels";
import { resetLinkPreview } from "../mocks/link-preview";
import { resetPushNotify } from "../mocks/push-notify";
import { resetRealtimeStream } from "../mocks/realtime-stream";
import { resetSystemMessages } from "../mocks/system-messages";

import { api } from "@/lib/api/v1";

/** Shared fixtures/helpers for the lib/api/v1.*.test.ts route-wiring suites. */

let idCounter = 0;
/** A syntactically valid v4-looking UUID, unique per call across every test file. */
export function uuid(): string {
    idCounter++;
    const n = idCounter.toString(16).padStart(12, "0");
    return `${n.slice(0, 8)}-${n.slice(8, 12)}-4${n.slice(0, 3)}-8${n.slice(0, 3)}-${n}`;
}

export type Actor = {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    appRole: "owner" | "admin" | "user";
    approvalStatus: "approved" | "pending" | "rejected";
    createdAt: string;
    updatedAt: string;
};

/** Authenticate the next request as this user (one-shot, like the real session check). */
export function signedInAs(overrides: Partial<Actor> = {}): Actor {
    const actor: Actor = {
        id: uuid(),
        name: "Test User",
        email: `${uuid()}@example.com`,
        emailVerified: true,
        image: null,
        appRole: "user",
        approvalStatus: "approved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
    auth.api.getSession.mockResolvedValueOnce({ user: actor });
    return actor;
}

export function makeChannel(overrides: Record<string, unknown> = {}) {
    return {
        id: uuid(),
        name: "General",
        description: null,
        color: "#3b82f6",
        icon: "hash",
        isPrivate: false,
        isArchived: false,
        archivedAt: null,
        createdByUserId: uuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

export function request(method: string, path: string, json?: unknown) {
    const init: RequestInit = { method };
    if (json !== undefined) {
        init.headers = { "content-type": "application/json" };
        init.body = JSON.stringify(json);
    }
    return api.request(`/api/v1${path}`, init);
}

/** Call from every suite's `beforeEach` — resets every mock these tests touch. */
export function resetAllMocks() {
    resetAuth();
    resetDb();
    resetBroker();
    resetCloudinary();
    resetDefaultChannels();
    resetLinkPreview();
    resetPushNotify();
    resetRealtimeStream();
    resetSystemMessages();
}

export { auth };
