import "server-only";

import postgres from "postgres";

export type RealtimeEvent = {
    type:
        | "ready"
        | "resync"
        | "message.created"
        | "message.updated"
        | "message.deleted"
        | "reaction.changed"
        | "read.updated"
        | "channels.changed"
        | "users.changed"
        | "settings.changed"
        | "typing"
        | "presence"
        | "presence.snapshot";
    channelId?: string;
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
            // A reconnect may have missed notifications — have clients refetch.
            this.broadcast({ type: "resync", ts: Date.now() });
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
        this.dispatch(event);
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

    subscribe(opts: {
        userId: string;
        channelIds: string[];
        push: (event: RealtimeEvent) => void;
    }): () => void {
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
