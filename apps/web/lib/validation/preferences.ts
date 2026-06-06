import { z } from "zod";

export const DATE_TIME_FORMATS = ["relative", "12h", "24h"] as const;
export const THEME_OPTIONS = ["system", "light", "dark"] as const;

export type DateTimeFormat = (typeof DATE_TIME_FORMATS)[number];
export type ThemeOption = (typeof THEME_OPTIONS)[number];

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
    dateTimeFormat: z.enum(DATE_TIME_FORMATS)
});
