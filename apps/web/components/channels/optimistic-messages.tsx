"use client";

import { createContext, useCallback, useContext, useState } from "react";

import type { ChannelMessage } from "@/lib/queries/channels";

/**
 * An optimistically-rendered message: a full {@link ChannelMessage} (so the
 * existing list/item components render it unchanged) plus the bookkeeping the
 * composer needs to reconcile it. `nonce` is the client-generated key; `realId`
 * is filled in once the server confirms the insert, after which the entry is
 * dropped as soon as the server copy appears in the refetched list.
 */
export type OptimisticMessage = ChannelMessage & {
    pending: true;
    nonce: string;
    realId?: string;
};

type OptimisticMessagesValue = {
    pending: OptimisticMessage[];
    enqueue: (message: OptimisticMessage) => void;
    resolve: (nonce: string, server: { realId: string; createdAt: Date }) => void;
    fail: (nonce: string) => void;
    /** Drop confirmed entries whose persisted row is now in the server list. */
    reconcile: (serverIds: Set<string>) => void;
};

const OptimisticMessagesContext = createContext<OptimisticMessagesValue | null>(null);

/** Optional — the thread composer renders without a provider and falls back to a
 * plain (non-optimistic) send. */
export function useOptimisticMessages(): OptimisticMessagesValue | null {
    return useContext(OptimisticMessagesContext);
}

export function OptimisticMessagesProvider({ children }: { children: React.ReactNode }) {
    const [pending, setPending] = useState<OptimisticMessage[]>([]);

    const enqueue = useCallback((message: OptimisticMessage) => {
        setPending((prev) => [...prev, message]);
    }, []);

    const resolve = useCallback((nonce: string, server: { realId: string; createdAt: Date }) => {
        // Adopt the persisted id (and createdAt) so that when the server copy
        // arrives in the refetched list it reconciles to the same React key —
        // the row updates in place instead of remounting (no flicker).
        setPending((prev) =>
            prev.map((m) =>
                m.nonce === nonce
                    ? {
                          ...m,
                          id: server.realId,
                          realId: server.realId,
                          createdAt: server.createdAt
                      }
                    : m
            )
        );
    }, []);

    const fail = useCallback((nonce: string) => {
        setPending((prev) => prev.filter((m) => m.nonce !== nonce));
    }, []);

    const reconcile = useCallback((serverIds: Set<string>) => {
        setPending((prev) => {
            const next = prev.filter((m) => !(m.realId && serverIds.has(m.realId)));
            return next.length === prev.length ? prev : next;
        });
    }, []);

    return (
        <OptimisticMessagesContext.Provider value={{ pending, enqueue, resolve, fail, reconcile }}>
            {children}
        </OptimisticMessagesContext.Provider>
    );
}
