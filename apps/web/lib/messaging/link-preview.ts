import "server-only";

import { eq } from "drizzle-orm";
import ogs from "open-graph-scraper";

import { db } from "@workspace/db/client";
import { linkPreviews, messages } from "@workspace/db/schema";

import { isSafeUrl } from "@/lib/security/ssrf";
import { extractUrls } from "./links";

const OK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAIL_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

type PreviewData = {
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    siteName: string | null;
    cardType: string | null;
    faviconUrl: string | null;
};

function resolveMaybeRelative(value: string | undefined, base: string): string | null {
    if (!value) return null;
    try {
        return new URL(value, base).href;
    } catch {
        return null;
    }
}

async function fetchPreview(url: string): Promise<PreviewData | null> {
    if (!(await isSafeUrl(url))) return null;
    try {
        const { error, result } = await ogs({ url, timeout: FETCH_TIMEOUT_MS });
        if (error || !result.success) return null;
        return {
            title: result.ogTitle ?? result.twitterTitle ?? null,
            description: result.ogDescription ?? result.twitterDescription ?? null,
            imageUrl: resolveMaybeRelative(
                result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url,
                url
            ),
            siteName: result.ogSiteName ?? null,
            cardType: result.twitterCard ?? null,
            faviconUrl: resolveMaybeRelative(result.favicon, url)
        };
    } catch {
        return null;
    }
}

/** Fetch + cache one URL's preview. Returns true if a fresh OK preview was stored. */
async function ensureLinkPreview(url: string): Promise<boolean> {
    const existing = await db.query.linkPreviews.findFirst({ where: eq(linkPreviews.url, url) });
    if (existing?.expiresAt && existing.expiresAt.getTime() > Date.now()) {
        return false; // still cached
    }

    const data = await fetchPreview(url);
    const now = Date.now();
    const row = {
        url,
        status: data ? "ok" : "failed",
        title: data?.title ?? null,
        description: data?.description ?? null,
        imageUrl: data?.imageUrl ?? null,
        siteName: data?.siteName ?? null,
        cardType: data?.cardType ?? null,
        faviconUrl: data?.faviconUrl ?? null,
        fetchedAt: new Date(now),
        expiresAt: new Date(now + (data ? OK_TTL_MS : FAIL_TTL_MS))
    };

    await db
        .insert(linkPreviews)
        .values(row)
        .onConflictDoUpdate({ target: linkPreviews.url, set: row });

    return Boolean(data);
}

/**
 * Unfurl all links in a message body (fire-and-forget). When a new preview is
 * fetched, touch the message so a `message.updated` event re-renders the card.
 */
export async function ensureMessageLinkPreviews(messageId: string, body: string): Promise<void> {
    const urls = extractUrls(body);
    if (urls.length === 0) return;

    let anyNew = false;
    for (const url of urls) {
        try {
            if (await ensureLinkPreview(url)) anyNew = true;
        } catch {
            /* ignore individual failures */
        }
    }

    if (anyNew) {
        await db.update(messages).set({ updatedAt: new Date() }).where(eq(messages.id, messageId));
    }
}
