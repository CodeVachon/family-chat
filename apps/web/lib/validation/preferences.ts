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

export const notificationPrefsSchema = z.object({
    notificationLevel: z.enum(NOTIFICATION_LEVELS)
});

export const profilePrefsSchema = z.object({
    displayName: z
        .string()
        .trim()
        .max(50)
        .nullable()
        .transform((v) => (v && v.length > 0 ? v : null)),
    colorHue: z.number().int().min(0).max(360),
    avatarUrl: z.string().url().nullable()
});

export const appearancePrefsSchema = z.object({
    themePreference: z.enum(THEME_OPTIONS),
    dateTimeFormat: z.enum(DATE_TIME_FORMATS),
    fontSizeScale: z.enum(FONT_SIZE_SCALES),
    fontFamily: z.enum(FONT_FAMILIES)
});
