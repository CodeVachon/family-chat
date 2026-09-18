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

export const attachmentInputSchema = z.object({
    kind: z.enum(["image", "pdf", "file", "video"]),
    publicId: z.string().min(1),
    resourceType: z.string().min(1),
    secureUrl: z.string().url(),
    format: z.string().nullable(),
    bytes: z.number().int().nullable(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    originalFilename: z.string().nullable()
});

export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

export const postMessageObjectSchema = z.object({
    channelId: z.string().uuid(),
    threadRootId: z.string().uuid().nullable().default(null),
    // HTML body (rich text) — larger ceiling than the visible-text limit.
    body: z.string().max(20000),
    attachments: z.array(attachmentInputSchema).max(10).default([]),
    mentionUserIds: z.array(z.string()).max(20).default([]),
    // Caller-generated idempotency key for retrying an ambiguously-completed
    // send (see /api/v1's handler). Unused by the web app's own composer,
    // which has no cross-request retry to de-dupe.
    clientMessageId: z.string().uuid().optional()
});

// Kept separate from postMessageObjectSchema so callers (e.g. the v1 API,
// which omits channelId) can re-attach it — Zod v4 forbids .omit() on a
// schema that already has a .refine().
export const postMessageNotEmpty = (d: { body: string; attachments: unknown[] }) =>
    d.body.trim().length > 0 || d.attachments.length > 0;

export const postMessageSchema = postMessageObjectSchema.refine(postMessageNotEmpty, {
    message: "Message cannot be empty",
    path: ["body"]
});

export const editMessageSchema = z.object({
    messageId: z.string().uuid(),
    body: z.string().trim().min(1, "Message cannot be empty").max(20000),
    mentionUserIds: z.array(z.string()).max(20).default([])
});

export const channelMemberRoleSchema = z.enum(["admin", "user", "viewer"]);

/** Curated reaction set offered in the picker. */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙏", "👀", "🔥", "✅"];
