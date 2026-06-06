import "server-only";

import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIPv4(ip: string): boolean {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
}

function isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) return isPrivateIPv4(ip);
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("::ffff:")) return isPrivateIPv4(lower.replace("::ffff:", ""));
    return false;
}

/**
 * SSRF guard for outbound link-preview fetches: http(s) only, standard ports,
 * and the resolved host must not point at a private/loopback/metadata address.
 * (Residual redirect-to-internal risk is accepted for this trusted-user app.)
 */
export async function isSafeUrl(raw: string): Promise<boolean> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return false;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    if (port !== 80 && port !== 443) return false;

    const host = url.hostname;
    if (host === "localhost") return false;
    if (net.isIP(host)) return !isPrivateIp(host);

    try {
        const addrs = await dns.lookup(host, { all: true });
        return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
    } catch {
        return false;
    }
}
