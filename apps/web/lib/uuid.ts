/**
 * RFC-4122 v4 id that works in insecure contexts. `crypto.randomUUID` is only
 * defined in secure contexts (HTTPS, or localhost/127.0.0.1/*.localhost), so it
 * is `undefined` on a plain-HTTP LAN dev host (e.g. http://my-host.local) and
 * calling it throws. `crypto.getRandomValues` is available in all contexts, so
 * we fall back to it.
 */
export function randomId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return (
        hex.slice(0, 4).join("") +
        "-" +
        hex.slice(4, 6).join("") +
        "-" +
        hex.slice(6, 8).join("") +
        "-" +
        hex.slice(8, 10).join("") +
        "-" +
        hex.slice(10, 16).join("")
    );
}
