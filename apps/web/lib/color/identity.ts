/**
 * The user identity color: a user picks a hue, and we render the most saturated
 * version of that hue sRGB can actually show at the current theme's lightness.
 *
 * Previously one global chroma (`--user-c`) was applied to every hue. The sRGB
 * gamut permits very different amounts of chroma per hue, so a single constant
 * did both wrong things at once: violet and magenta sat below 60% of the chroma
 * available to them (the "muted" report), while teal, yellow and orange were
 * pushed *past* the boundary.
 *
 * Being past the boundary matters more than it sounds. Chrome does not apply CSS
 * Color 4 gamut mapping to an out-of-range `oklch()` — it clips per channel,
 * which shifts the hue. Measured in headless Chrome at L=0.5, C=0.2:
 * teal 185° landed on 179.4°, orange 55° on 35.9°, and yellow 95° on 75.5° —
 * `rgb(136,91,0)`, a brown. Clamping to each hue's in-gamut maximum here means
 * nothing is ever clipped, so no hue shifts and every color is as vivid as it
 * can legitimately be.
 */

/**
 * Lightness per theme. This is the single source of truth — the identity color is
 * built entirely in this module, so there is no corresponding CSS variable to
 * keep in sync.
 */
const IDENTITY_LIGHTNESS = { light: 0.5, dark: 0.78 } as const;

export type IdentityTheme = keyof typeof IDENTITY_LIGHTNESS;

/** Matches the `color_hue` column default, used for a missing/invalid hue. */
const FALLBACK_HUE = 220;

/**
 * Stay a hair inside the gamut boundary. A chroma sitting exactly on it can round
 * outward in the browser's own conversion and get clipped — the very hue shift
 * this module exists to avoid.
 */
const GAMUT_MARGIN = 0.97;

/** No sRGB color reaches this chroma in OKLCH, so it's a safe bisection ceiling. */
const CHROMA_CEILING = 0.5;

const EPSILON = 1e-6;

/** OKLCH → linear sRGB, via Björn Ottosson's oklab matrices. */
function toLinearSrgb(lightness: number, chroma: number, hueDeg: number): number[] {
    const hueRad = (hueDeg * Math.PI) / 180;
    const a = chroma * Math.cos(hueRad);
    const b = chroma * Math.sin(hueRad);

    const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
    const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
    const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;

    const l = lRoot ** 3;
    const m = mRoot ** 3;
    const s = sRoot ** 3;

    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
}

function inSrgb(rgb: number[]): boolean {
    return rgb.every((channel) => channel >= -EPSILON && channel <= 1 + EPSILON);
}

/** Largest chroma that stays inside sRGB at this lightness and hue. */
function maxSrgbChroma(lightness: number, hue: number): number {
    let low = 0;
    let high = CHROMA_CEILING;
    // 40 halvings takes the interval far below display precision.
    for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (inSrgb(toLinearSrgb(lightness, mid, hue))) low = mid;
        else high = mid;
    }
    return low;
}

/** A finite hue in [0, 360). */
function normalizeHue(hue: number): number {
    if (!Number.isFinite(hue)) return FALLBACK_HUE;
    return ((hue % 360) + 360) % 360;
}

// Bisecting per render would be wasteful — one page can show hundreds of names.
// Hues are stored as integers, so caching on the rounded hue covers real input.
const chromaCache = new Map<string, number>();

/** The chroma used for `hue` in `theme`: as saturated as sRGB permits. */
function identityChroma(theme: IdentityTheme, hue: number): number {
    const rounded = Math.round(normalizeHue(hue));
    const key = `${theme}:${rounded}`;
    const cached = chromaCache.get(key);
    if (cached !== undefined) return cached;

    const chroma = maxSrgbChroma(IDENTITY_LIGHTNESS[theme], rounded) * GAMUT_MARGIN;
    chromaCache.set(key, chroma);
    return chroma;
}

/** A ready-to-use `oklch()` for one theme. */
export function identityColor(theme: IdentityTheme, hue: number): string {
    const rounded = Math.round(normalizeHue(hue));
    const chroma = identityChroma(theme, rounded).toFixed(4);
    return `oklch(${IDENTITY_LIGHTNESS[theme]} ${chroma} ${rounded})`;
}

/**
 * Both themes' colors as custom properties. Pair with the `data-user-tint`
 * (text) or `data-user-ring` (avatar ring) attribute; globals.css selects the
 * variant for the active theme. Two values are needed rather than one because
 * the in-gamut maximum differs between the two lightnesses — at L=0.78 a red can
 * only reach chroma 0.128, where at L=0.5 it reaches 0.203 — so no single value
 * serves both themes.
 */
export function identityTintStyle(hue: number): Record<string, string> {
    return {
        "--user-tint-light": identityColor("light", hue),
        "--user-tint-dark": identityColor("dark", hue)
    };
}

/**
 * The same custom properties as a `style` attribute string, for the mention
 * tinting in `renderMessageHtml`, which injects style after sanitization. Every
 * interpolated value is numeric by construction (see `identityColor`), so this
 * cannot carry a CSS payload even if `colorHue` were ever attacker-influenced.
 */
export function identityTintCss(hue: number): string {
    return [
        `--user-tint-light:${identityColor("light", hue)}`,
        `--user-tint-dark:${identityColor("dark", hue)}`
    ].join(";");
}

/**
 * A full-spectrum gradient built from the colors actually achievable, for the
 * hue picker's track. Sampling every 15° keeps the string short while staying
 * smooth; because chroma varies per hue, the track legitimately looks stronger
 * around violet and weaker around teal — which is what the user will get.
 */
export function identityHueGradient(theme: IdentityTheme): string {
    const stops: string[] = [];
    for (let hue = 0; hue <= 360; hue += 15) {
        stops.push(`${identityColor(theme, hue)} ${((hue / 360) * 100).toFixed(1)}%`);
    }
    return `linear-gradient(to right, ${stops.join(", ")})`;
}
