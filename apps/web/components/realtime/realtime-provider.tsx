"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type TypingUser = { userId: string; name: string };

type RealtimeContextValue = {
    connected: boolean;
    onlineUserIds: Set<string>;
    typingUsersFor: (channelId: string) => TypingUser[];
    sendTyping: (channelId: string) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime(): RealtimeContextValue {
    const ctx = useContext(RealtimeContext);
    if (!ctx) throw new Error("useRealtime must be used within a RealtimeProvider");
    return ctx;
}

// Event types that simply require refetching server data.
const REFRESH_EVENTS = new Set([
    "message.created",
    "message.updated",
    "message.deleted",
    "reaction.changed",
    "read.updated",
    "users.changed",
    "settings.changed",
    "resync"
]);

const TYPING_TTL_MS = 5000;
const TYPING_THROTTLE_MS = 3000;
const REFRESH_DEBOUNCE_MS = 150;
const RECONNECT_DEBOUNCE_MS = 250;

type TypingMap = Map<string, Map<string, { name: string; expiresAt: number }>>;

export function RealtimeProvider({
    userId,
    children
}: {
    userId: string;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [connected, setConnected] = useState(true);
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const [, setTypingVersion] = useState(0);
    // Bumping this reconnects the EventSource so its channel subscription is
    // recomputed (e.g. after a channel is created or membership changes).
    const [connectionEpoch, setConnectionEpoch] = useState(0);

    const typingRef = useRef<TypingMap>(new Map());
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTypingSent = useRef(0);

    const scheduleRefresh = useCallback(() => {
        if (refreshTimer.current) return;
        refreshTimer.current = setTimeout(() => {
            refreshTimer.current = null;
            router.refresh();
        }, REFRESH_DEBOUNCE_MS);
    }, [router]);

    const scheduleReconnect = useCallback(() => {
        if (reconnectTimer.current) return;
        reconnectTimer.current = setTimeout(() => {
            reconnectTimer.current = null;
            setConnectionEpoch((e) => e + 1);
        }, RECONNECT_DEBOUNCE_MS);
    }, []);

    const addTyping = useCallback((channelId: string, typingUserId: string, name: string) => {
        const channel = typingRef.current.get(channelId) ?? new Map();
        channel.set(typingUserId, { name, expiresAt: Date.now() + TYPING_TTL_MS });
        typingRef.current.set(channelId, channel);
        setTypingVersion((v) => v + 1);
    }, []);

    useEffect(() => {
        let openedOnce = false;
        const source = new EventSource("/api/stream");

        source.onopen = () => {
            setConnected(true);
            // On a reconnect we may have missed events — refetch.
            if (openedOnce) scheduleRefresh();
            openedOnce = true;
        };

        source.onerror = () => {
            // EventSource auto-reconnects; reflect the dropped state meanwhile.
            setConnected(false);
        };

        source.onmessage = (e) => {
            let event: {
                type: string;
                channelId?: string;
                userId?: string;
                name?: string;
                online?: boolean;
                onlineUserIds?: string[];
            };
            try {
                event = JSON.parse(e.data);
            } catch {
                return;
            }

            if (REFRESH_EVENTS.has(event.type)) {
                scheduleRefresh();
                return;
            }
            if (event.type === "channels.changed") {
                // Refresh + reconnect so the subscription set picks up
                // newly-visible channels for live message delivery.
                scheduleRefresh();
                scheduleReconnect();
                return;
            }
            if (event.type === "typing") {
                if (event.userId && event.userId !== userId && event.channelId) {
                    addTyping(event.channelId, event.userId, event.name ?? "Someone");
                }
                return;
            }
            if (event.type === "presence.snapshot") {
                setOnlineUserIds(new Set(event.onlineUserIds ?? []));
                return;
            }
            if (event.type === "presence" && event.userId) {
                setOnlineUserIds((prev) => {
                    const next = new Set(prev);
                    if (event.online) next.add(event.userId!);
                    else next.delete(event.userId!);
                    return next;
                });
            }
        };

        return () => source.close();
    }, [userId, scheduleRefresh, scheduleReconnect, addTyping, connectionEpoch]);

    // Expire stale typing entries.
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            let changed = false;
            for (const [channelId, users] of typingRef.current) {
                for (const [uid, info] of users) {
                    if (info.expiresAt <= now) {
                        users.delete(uid);
                        changed = true;
                    }
                }
                if (users.size === 0) typingRef.current.delete(channelId);
            }
            if (changed) setTypingVersion((v) => v + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const typingUsersFor = useCallback((channelId: string): TypingUser[] => {
        const users = typingRef.current.get(channelId);
        if (!users) return [];
        return [...users.entries()].map(([uid, info]) => ({ userId: uid, name: info.name }));
    }, []);

    const sendTyping = useCallback((channelId: string) => {
        const now = Date.now();
        if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
        lastTypingSent.current = now;
        void fetch("/api/typing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId })
        });
    }, []);

    return (
        <RealtimeContext.Provider value={{ connected, onlineUserIds, typingUsersFor, sendTyping }}>
            {children}
        </RealtimeContext.Provider>
    );
}
