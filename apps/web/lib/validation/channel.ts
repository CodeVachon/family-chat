import { z } from "zod";

/** Preset palette for channel colors (hex). */
export const CHANNEL_COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#3b82f6",
    "#6366f1",
    "#a855f7",
    "#ec4899",
    "#64748b"
] as const;

/** Curated lucide icon names selectable for a channel. */
export const CHANNEL_ICONS = [
    "hash",
    "message-circle",
    "users",
    "home",
    "star",
    "heart",
    "bell",
    "calendar",
    "camera",
    "music",
    "gamepad-2",
    "utensils",
    "plane",
    "gift",
    "book-open",
    "briefcase"
] as const;

export const channelFormSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(80),
    description: z
        .string()
        .trim()
        .max(280)
        .optional()
        .transform((v) => (v ? v : null)),
    color: z.enum(CHANNEL_COLORS).optional(),
    icon: z.enum(CHANNEL_ICONS).optional(),
    isPrivate: z.boolean().default(false)
});

export const messageFormSchema = z.object({
    channelId: z.string().uuid(),
    body: z.string().trim().min(1, "Message cannot be empty").max(4000)
});

export const channelMemberRoleSchema = z.enum(["admin", "user", "viewer"]);
