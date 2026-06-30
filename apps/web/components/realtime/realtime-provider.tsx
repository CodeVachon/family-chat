"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
// A mentioned 'all'-level member receives both a `message.created` and a
// `mention` event for the same message (separate NOTIFYs from one transaction,
// `message.created` delivered first). Briefly hold the generic "new message"
// toast so an immediately-following `mention` for the same message can cancel
// it — the mention is the more specific notification and wins.
const MENTION_DEDUP_WINDOW_MS = 500;

type TypingMap = Map<string, Map<string, { name: string; expiresAt: number }>>;

export function RealtimeProvider({
    userId,
    notificationLevel,
    children
}: {
    userId: string;
    notificationLevel: "all" | "mentions" | "none";
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
    // Pending "new message" toasts awaiting a possible same-message mention.
    const pendingMessageToasts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    // messageIds already notified as a mention, to suppress a `message.created`
    // that arrives after the mention (e.g. reordered across a reconnect).
    const mentionedMessageIds = useRef<Map<string, number>>(new Map());
    // Read the latest level inside the (long-lived) EventSource handler.
    const levelRef = useRef(notificationLevel);
    useEffect(() => {
        levelRef.current = notificationLevel;
    }, [notificationLevel]);

    const notify = useCallback(
        (title: string, body: string, channelId: string) => {
            toast(title, {
                description: body,
                action: { label: "View", onClick: () => router.push(`/channels/${channelId}`) }
            });
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                const n = new Notification(title, { body });
                n.onclick = () => {
                    window.focus();
                    router.push(`/channels/${channelId}`);
                };
            }
        },
        [router]
    );

    const viewingChannel = useCallback((channelId: string) => {
        return typeof window !== "undefined" && window.location.pathname.includes(channelId);
    }, []);

    // A mention is the more specific notification: show it, and (by messageId)
    // cancel a held "new message" toast or suppress one arriving just after.
    const notifyMention = useCallback(
        (event: { channelId: string; channelName?: string; messageId?: string }) => {
            if (event.messageId) {
                const pending = pendingMessageToasts.current.get(event.messageId);
                if (pending) {
                    clearTimeout(pending);
                    pendingMessageToasts.current.delete(event.messageId);
                }
                mentionedMessageIds.current.set(
                    event.messageId,
                    Date.now() + MENTION_DEDUP_WINDOW_MS
                );
            }
            notify(
                "New mention",
                event.channelName
                    ? `You were mentioned in #${event.channelName}`
                    : "You were mentioned",
                event.channelId
            );
        },
        [notify]
    );

    // Show a generic "new message" toast, but hold it briefly so a same-message
    // mention can win the dedup (and skip outright if the mention already fired).
    const notifyNewMessage = useCallback(
        (channelId: string, messageId?: string) => {
            if (!messageId) {
                notify("New message", "You have a new message", channelId);
                return;
            }
            if (mentionedMessageIds.current.has(messageId)) {
                mentionedMessageIds.current.delete(messageId);
                return;
            }
            const timer = setTimeout(() => {
                pendingMessageToasts.current.delete(messageId);
                // Re-check at fire time: the user may have opened the channel
                // during the dedup window, which should suppress the toast.
                if (viewingChannel(channelId)) return;
                notify("New message", "You have a new message", channelId);
            }, MENTION_DEDUP_WINDOW_MS);
            pendingMessageToasts.current.set(messageId, timer);
        },
        [notify, viewingChannel]
    );

    const maybeNotify = useCallback(
        (event: {
            type: string;
            channelId?: string;
            channelName?: string;
            actorId?: string;
            messageId?: string;
        }) => {
            const level = levelRef.current;
            if (level === "none" || !event.channelId) return;

            // Drop expired dedup markers so the map can't grow unbounded.
            const now = Date.now();
            for (const [id, expiry] of mentionedMessageIds.current) {
                if (expiry <= now) mentionedMessageIds.current.delete(id);
            }

            if (event.type === "mention") {
                notifyMention({ ...event, channelId: event.channelId });
            } else if (
                event.type === "message.created" &&
                level === "all" &&
                event.actorId &&
                event.actorId !== userId &&
                !viewingChannel(event.channelId)
            ) {
                notifyNewMessage(event.channelId, event.messageId);
            }
        },
        [notifyMention, notifyNewMessage, userId, viewingChannel]
    );

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
                channelName?: string;
                actorId?: string;
                messageId?: string;
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

            if (event.type === "mention" || REFRESH_EVENTS.has(event.type)) {
                scheduleRefresh();
                maybeNotify(event);
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

        const pending = pendingMessageToasts.current;
        return () => {
            source.close();
            for (const timer of pending.values()) clearTimeout(timer);
            pending.clear();
        };
    }, [userId, scheduleRefresh, scheduleReconnect, addTyping, maybeNotify, connectionEpoch]);

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
