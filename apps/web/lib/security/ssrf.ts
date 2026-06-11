import "server-only";

import dns from "node:dns";
import net from "node:net";

import ipaddr from "ipaddr.js";
import { Agent } from "undici";

/**
 * True only for ordinary public unicast addresses. Private, loopback,
 * link-local, CGNAT, multicast, unspecified, reserved and the IPv6 transition
 * ranges (6to4 / Teredo / NAT64) all return a non-"unicast" range and are
 * rejected; an IPv4-mapped IPv6 address is unwrapped and its IPv4 checked.
 */
function isPublicAddress(ip: string): boolean {
    let addr: ipaddr.IPv4 | ipaddr.IPv6;
    try {
        addr = ipaddr.parse(ip);
    } catch {
        return false;
    }
    if (addr.kind() === "ipv6") {
        const v6 = addr as ipaddr.IPv6;
        if (v6.isIPv4MappedAddress()) {
            return v6.toIPv4Address().range() === "unicast";
        }
    }
    return addr.range() === "unicast";
}

// Decimal/octal/hex-encoded numeric hosts (e.g. 2130706433, 0x7f000001,
// 0177.0.0.1) aren't valid dotted IPs, so net.isIP misses them — yet
// getaddrinfo can still resolve them to internal addresses. Reject up front.
const NUMERIC_HOST = /^(0x[0-9a-f]+|[0-9]+|[0-9.]+)$/i;

/** Strip the brackets URL.hostname keeps around IPv6 literals (e.g. `[::1]`). */
function unbracket(host: string): string {
    return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/**
 * SSRF guard for outbound link-preview fetches: http(s) only, standard ports,
 * and the resolved host must not point at a private/loopback/metadata address.
 * This is a cheap pre-flight check — the authoritative protection is
 * {@link ssrfSafeDispatcher}, which re-validates the connected IP on every hop
 * (including redirects), closing redirect-to-internal and DNS-rebinding races.
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

    const host = unbracket(url.hostname);
    if (host === "localhost") return false;
    if (net.isIP(host)) return isPublicAddress(host);
    if (NUMERIC_HOST.test(host)) return false;

    try {
        const addrs = await dns.promises.lookup(host, { all: true });
        return addrs.length > 0 && addrs.every((a) => isPublicAddress(a.address));
    } catch {
        return false;
    }
}

/**
 * undici dispatcher whose DNS lookup validates the resolved IP at connect time
 * and connects only to that exact address. Because every connection — including
 * each redirect hop — flows through this lookup, it closes redirect-to-internal
 * SSRF and DNS-rebinding/TOCTOU in one place: there is no second, unchecked
 * resolution between the check and the connect. Timeouts bound how long a slow
 * internal endpoint can tie up the request.
 */
export const ssrfSafeDispatcher = new Agent({
    connect: {
        lookup(hostname, options, callback) {
            dns.lookup(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
                if (err) return callback(err, "", 0);
                const list = (
                    Array.isArray(addresses) ? addresses : [addresses]
                ) as dns.LookupAddress[];
                const blocked = list.find((a) => !isPublicAddress(a.address));
                if (list.length === 0 || blocked) {
                    callback(
                        new Error(`Blocked non-public address: ${blocked?.address ?? hostname}`),
                        "",
                        0
                    );
                    return;
                }
                if (options.all) {
                    callback(null, list as never);
                } else {
                    callback(null, list[0]!.address, list[0]!.family);
                }
            });
        }
    },
    connectTimeout: 5000,
    headersTimeout: 5000,
    bodyTimeout: 5000
});
