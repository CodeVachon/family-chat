import { z } from "zod";

export const DATE_TIME_FORMATS = ["relative", "12h", "24h"] as const;
export const THEME_OPTIONS = ["system", "light", "dark"] as const;
export const NOTIFICATION_LEVELS = ["all", "mentions", "none"] as const;
export const FONT_SIZE_SCALES = ["small", "default", "large", "xlarge"] as const;
// Body typefaces offered to users. "figtree" is the app default; the rest are
// legible free Google fonts (Atkinson Hyperlegible is purpose-built for low
// vision). Each must be loaded in app/layout.tsx and mapped in globals.css.
export const FONT_FAMILIES = ["figtree", "inter", "open-sans", "nunito-sans", "atkinson"] as const;

export type DateTimeFormat = (typeof DATE_TIME_FORMATS)[number];
export type ThemeOption = (typeof THEME_OPTIONS)[number];
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];
export type FontSizeScale = (typeof FONT_SIZE_SCALES)[number];
export type FontFamily = (typeof FONT_FAMILIES)[number];

/** Whether a string is a valid IANA time zone the runtime recognizes. */
function isValidTimeZone(tz: string): boolean {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

const timezoneField = z.string().trim().max(64).refine(isValidTimeZone, "Invalid time zone");

export const notificationPrefsSchema = z.object({
    notificationLevel: z.enum(NOTIFICATION_LEVELS),
    // Nightly unread-digest email opt-in + the user's IANA timezone. Optional so
    // a partial payload preserves the stored value (see upsertPreferences).
    dailyDigestEnabled: z.boolean().optional(),
    timezone: timezoneField.nullable().optional()
});

/** Auto-capture of the user's detected timezone (only applied when unset). */
export const timezoneCaptureSchema = z.object({ timezone: timezoneField });

/** Trim, then collapse empty strings to null. */
const optionalText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .nullable()
        .transform((v) => (v && v.length > 0 ? v : null));

const avatarCropSchema = z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive()
});

export const profilePrefsSchema = z.object({
    displayName: optionalText(50),
    colorHue: z.number().int().min(0).max(360),
    avatarUrl: z.string().url().nullable(),
    // These are `.optional()` (not `.default(null)`) so a payload that omits a
    // key leaves the stored value untouched rather than nulling it. An explicit
    // null (a field cleared in the form, which always sends every key) still
    // clears it. See `upsertPreferences`, which drops `undefined` keys.
    bio: optionalText(280).optional(),
    phone: optionalText(30).optional(),
    bannerUrl: z.string().url().nullable().optional(),
    // Raw uploaded image + manual crop, kept so the editor can be reopened.
    // Both null when the avatar is cleared or has no manual crop.
    avatarSourceUrl: z.string().url().nullable().optional(),
    avatarCrop: avatarCropSchema.nullable().optional()
});

/** The avatar as a self-contained, immediately-saved unit (the editor's "Save
 * crop" / "Remove"). Only these three keys are written, so an avatar save can
 * never disturb the other profile fields. */
export const avatarPrefsSchema = z.object({
    avatarUrl: z.string().url().nullable(),
    avatarSourceUrl: z.string().url().nullable(),
    avatarCrop: avatarCropSchema.nullable()
});

export const appearancePrefsSchema = z.object({
    themePreference: z.enum(THEME_OPTIONS),
    dateTimeFormat: z.enum(DATE_TIME_FORMATS),
    fontSizeScale: z.enum(FONT_SIZE_SCALES),
    fontFamily: z.enum(FONT_FAMILIES)
});
