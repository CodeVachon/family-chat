import "server-only";

import { eq } from "drizzle-orm";
import ogs from "open-graph-scraper";

import { db } from "@workspace/db/client";
import { linkPreviews, messages } from "@workspace/db/schema";

import { isSafeUrl, ssrfSafeDispatcher } from "@/lib/security/ssrf";
import { extractUrls } from "./links";

const OK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAIL_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_SECONDS = 5;

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
        const url = new URL(value, base);
        // Preview image/favicon URLs come from attacker-controlled OpenGraph tags
        // and are rendered client-side as <img src>. Only allow https: so a
        // viewer's browser never fetches data:/http:/other-scheme URLs (content
        // injection, large-payload DoS, and cross-origin IP/tracking disclosure).
        return url.protocol === "https:" ? url.href : null;
    } catch {
        return null;
    }
}

/** Smallest side (px) an OpenGraph image must declare to be used as the card
 * image; smaller declared images are almost always logos/icons. Images with no
 * declared size are kept (we can't judge them). */
const MIN_IMAGE_SIDE = 120;

type OgImage = { url?: string; width?: string | number; height?: string | number };

/**
 * Choose the best preview image from the OpenGraph/Twitter candidates: drop
 * images explicitly sized like an icon/logo, prefer the largest with known
 * dimensions, and only fall back to an unsized image when nothing better
 * exists. Returns null rather than a wrong/tiny image.
 */
function pickPreviewImage(candidates: OgImage[], base: string): string | null {
    const sized = candidates
        .map((c) => ({
            url: resolveMaybeRelative(c.url, base),
            w: Number(c.width) || 0,
            h: Number(c.height) || 0
        }))
        .filter((c): c is { url: string; w: number; h: number } => Boolean(c.url));
    if (sized.length === 0) return null;

    const unsized = (c: { w: number; h: number }) => c.w === 0 && c.h === 0;
    const bigEnough = (c: { w: number; h: number }) =>
        Math.min(c.w || Infinity, c.h || Infinity) >= MIN_IMAGE_SIDE;
    const usable = sized.filter((c) => unsized(c) || bigEnough(c));
    // If every candidate is explicitly icon-sized, show no image rather than a
    // wrong/tiny one.
    if (usable.length === 0) return null;
    // Largest known area first; unsized (area 0) sort last.
    usable.sort((a, b) => b.w * b.h - a.w * a.h);
    return usable[0]!.url;
}

async function fetchPreview(url: string): Promise<PreviewData | null> {
    if (!(await isSafeUrl(url))) return null;
    try {
        // ogs `timeout` is in seconds. Route the fetch through the SSRF-safe
        // dispatcher so every connection (incl. redirects) re-validates the IP.
        const { error, result } = await ogs({
            url,
            timeout: FETCH_TIMEOUT_SECONDS,
            fetchOptions: { dispatcher: ssrfSafeDispatcher }
        });
        if (error || !result.success) return null;
        return {
            title: result.ogTitle ?? result.twitterTitle ?? null,
            description: result.ogDescription ?? result.twitterDescription ?? null,
            imageUrl: pickPreviewImage(
                [...(result.ogImage ?? []), ...(result.twitterImage ?? [])],
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
