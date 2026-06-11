import "server-only";

import postgres from "postgres";

import { listVisibleChannelIds } from "@/lib/queries/channels";

export type RealtimeEvent = {
    type:
        | "ready"
        | "resync"
        | "message.created"
        | "message.updated"
        | "message.deleted"
        | "reaction.changed"
        | "mention"
        | "read.updated"
        | "channels.changed"
        | "users.changed"
        | "settings.changed"
        | "typing"
        | "presence"
        | "presence.snapshot";
    channelId?: string;
    channelName?: string;
    messageId?: string;
    actorId?: string;
    targetUserId?: string;
    userId?: string;
    name?: string;
    online?: boolean;
    onlineUserIds?: string[];
    ts: number;
};

type Subscriber = {
    id: number;
    userId: string;
    channelIds: Set<string>;
    push: (event: RealtimeEvent) => void;
};

const PRESENCE_GRACE_MS = 3000;

// Bound in-memory SSE subscribers so a single user (or script) can't open
// thousands of connections and exhaust memory / file descriptors. Per-user
// covers a handful of tabs/devices; the global ceiling is a backstop.
const MAX_CONNECTIONS_PER_USER = 10;
const MAX_TOTAL_CONNECTIONS = 1000;

/**
 * Single in-process broker holding one Postgres LISTEN connection and fanning
 * `chat_events` out to all connected SSE subscribers. Typing/presence are
 * in-memory only and never touch Postgres.
 */
class Broker {
    private subscribers = new Map<number, Subscriber>();
    private nextId = 1;
    private listenClient: ReturnType<typeof postgres> | null = null;
    private startPromise: Promise<void> | null = null;
    private listenedOnce = false;

    // Coalesces bursts of channels.changed into a single membership re-resolve.
    private refreshing = false;
    private refreshQueued = false;

    // Presence
    private connectionCounts = new Map<string, number>();
    private online = new Set<string>();
    private offlineTimers = new Map<string, ReturnType<typeof setTimeout>>();

    start(): Promise<void> {
        if (!this.startPromise) {
            this.startPromise = this.doStart();
        }
        return this.startPromise;
    }

    private async doStart(): Promise<void> {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error("DATABASE_URL is not set");

        this.listenClient = postgres(url, { max: 1, onnotice: () => {} });
        await this.listenClient.listen(
            "chat_events",
            (payload) => this.onNotify(payload),
            () => this.onListen()
        );
    }

    /** Fires on initial LISTEN and on every reconnect. */
    private onListen(): void {
        if (this.listenedOnce) {
            // A reconnect may have missed notifications — have clients refetch and
            // re-resolve fan-out scope in case a channels.changed was missed.
            this.broadcast({ type: "resync", ts: Date.now() });
            void this.refreshSubscriptions();
        }
        this.listenedOnce = true;
    }

    private onNotify(payload: string): void {
        let event: RealtimeEvent;
        try {
            event = JSON.parse(payload) as RealtimeEvent;
        } catch {
            return;
        }
        // Channel/membership changed: re-resolve every subscriber's visible
        // channel set so server-side fan-out is authoritative — a removed member
        // stops receiving channel events even if its client never reconnects.
        if (event.type === "channels.changed") void this.refreshSubscriptions();
        this.dispatch(event);
    }

    /**
     * Re-query each connected user's visible channels and replace their
     * subscription set so server-side fan-out is authoritative. Coalesces
     * concurrent calls: a burst of channels.changed collapses into a single
     * follow-up pass once the in-flight one finishes.
     */
    private async refreshSubscriptions(): Promise<void> {
        if (this.refreshing) {
            this.refreshQueued = true;
            return;
        }
        this.refreshing = true;
        try {
            do {
                this.refreshQueued = false;
                await this.resolveAllSubscriptions();
            } while (this.refreshQueued);
        } finally {
            this.refreshing = false;
        }
    }

    /** Re-resolve the channel set of every distinct connected user (once each). */
    private async resolveAllSubscriptions(): Promise<void> {
        const userIds = new Set<string>();
        for (const sub of this.subscribers.values()) userIds.add(sub.userId);
        for (const userId of userIds) await this.resolveUserSubscription(userId);
    }

    /** Replace one user's subscription set; keeps the old set on query failure. */
    private async resolveUserSubscription(userId: string): Promise<void> {
        let next: Set<string>;
        try {
            next = new Set(await listVisibleChannelIds(userId));
        } catch {
            return;
        }
        for (const sub of this.subscribers.values()) {
            if (sub.userId === userId) sub.channelIds = next;
        }
    }

    /** Route an event to the subscribers that should receive it. */
    private dispatch(event: RealtimeEvent): void {
        for (const sub of this.subscribers.values()) {
            if (event.targetUserId) {
                if (sub.userId === event.targetUserId) sub.push(event);
            } else if (event.channelId) {
                if (sub.channelIds.has(event.channelId)) sub.push(event);
            } else {
                sub.push(event);
            }
        }
    }

    private broadcast(event: RealtimeEvent): void {
        for (const sub of this.subscribers.values()) sub.push(event);
    }

    /** In-memory only (typing, presence) — never persisted. */
    publishEphemeral(event: RealtimeEvent): void {
        this.dispatch(event);
    }

    /**
     * Whether a new connection for this user would be within the per-user and
     * global caps. Lets the route reject with a 429 before opening the stream.
     */
    hasCapacityFor(userId: string): boolean {
        return !this.atCapacity(userId);
    }

    private atCapacity(userId: string): boolean {
        if (this.subscribers.size >= MAX_TOTAL_CONNECTIONS) return true;
        return (this.connectionCounts.get(userId) ?? 0) >= MAX_CONNECTIONS_PER_USER;
    }

    subscribe(opts: {
        userId: string;
        channelIds: string[];
        push: (event: RealtimeEvent) => void;
    }): (() => void) | null {
        // Authoritative guard (the route's pre-check can race under bursts).
        if (this.atCapacity(opts.userId)) return null;

        const id = this.nextId++;
        this.subscribers.set(id, {
            id,
            userId: opts.userId,
            channelIds: new Set(opts.channelIds),
            push: opts.push
        });

        // Tell the new subscriber who is currently online.
        opts.push({ type: "presence.snapshot", onlineUserIds: [...this.online], ts: Date.now() });
        this.trackConnect(opts.userId);

        return () => this.unsubscribe(id);
    }

    private unsubscribe(id: number): void {
        const sub = this.subscribers.get(id);
        if (!sub) return;
        this.subscribers.delete(id);
        this.trackDisconnect(sub.userId);
    }

    private trackConnect(userId: string): void {
        this.connectionCounts.set(userId, (this.connectionCounts.get(userId) ?? 0) + 1);

        const pendingOffline = this.offlineTimers.get(userId);
        if (pendingOffline) {
            // Was about to go offline (e.g. a refresh) — cancel, stays online.
            clearTimeout(pendingOffline);
            this.offlineTimers.delete(userId);
            return;
        }
        if (!this.online.has(userId)) {
            this.online.add(userId);
            this.publishEphemeral({ type: "presence", userId, online: true, ts: Date.now() });
        }
    }

    private trackDisconnect(userId: string): void {
        const next = (this.connectionCounts.get(userId) ?? 1) - 1;
        if (next > 0) {
            this.connectionCounts.set(userId, next);
            return;
        }
        this.connectionCounts.delete(userId);

        // Grace period so a quick refresh doesn't flicker offline/online.
        const timer = setTimeout(() => {
            this.offlineTimers.delete(userId);
            this.online.delete(userId);
            this.publishEphemeral({ type: "presence", userId, online: false, ts: Date.now() });
        }, PRESENCE_GRACE_MS);
        this.offlineTimers.set(userId, timer);
    }

    async shutdown(): Promise<void> {
        for (const timer of this.offlineTimers.values()) clearTimeout(timer);
        this.offlineTimers.clear();
        this.subscribers.clear();
        if (this.listenClient) {
            await this.listenClient.end({ timeout: 5 });
            this.listenClient = null;
        }
        this.startPromise = null;
        this.listenedOnce = false;
    }
}

// Pin to globalThis so Next dev HMR doesn't spawn duplicate LISTEN connections.
const globalForBroker = globalThis as unknown as { __chatBroker?: Broker };

export function getBroker(): Broker {
    if (!globalForBroker.__chatBroker) {
        globalForBroker.__chatBroker = new Broker();
    }
    return globalForBroker.__chatBroker;
}
