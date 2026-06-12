import "server-only";

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const rawFrom = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

const resend = apiKey ? new Resend(apiKey) : null;

/** The bare address out of EMAIL_FROM (which may be `Name <addr>` or just `addr`). */
const fromAddress = rawFrom.match(/<([^>]+)>/)?.[1] ?? rawFrom.trim();

type SendArgs = {
    to: string;
    subject: string;
    html: string;
    /** Display name for the sender; defaults to whatever EMAIL_FROM specifies. */
    fromName?: string;
};

/**
 * Sends an email via Resend. In development without a RESEND_API_KEY configured
 * we log to the console instead of failing, so auth flows remain testable.
 */
export async function sendEmail({ to, subject, html, fromName }: SendArgs): Promise<void> {
    const from = fromName ? `${fromName} <${fromAddress}>` : rawFrom;

    if (!resend) {
        console.warn(
            `[email] RESEND_API_KEY not set — skipping send.\n  from: ${from}\n  to: ${to}\n  subject: ${subject}`
        );
        return;
    }

    const { error } = await resend.emails.send({ from, to, subject, html });

    if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

/** Escape user-controlled text (e.g. channel names) before embedding in HTML. */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export type DigestChannelSummary = {
    name: string;
    unreadCount: number;
    mentionCount: number;
};

/** Nightly unread-digest: total unread + per-channel counts + a link back in. */
export function dailyDigestEmail(
    appName: string,
    recipientName: string,
    channels: DigestChannelSummary[],
    appUrl: string
): { subject: string; html: string } {
    const total = channels.reduce((sum, c) => sum + c.unreadCount, 0);
    const rows = channels
        .map((c) => {
            const mentions =
                c.mentionCount > 0
                    ? ` — ${c.mentionCount} mention${c.mentionCount === 1 ? "" : "s"}`
                    : "";
            return `<li><strong>#${escapeHtml(c.name)}</strong>: ${c.unreadCount} unread${mentions}</li>`;
        })
        .join("");
    return {
        subject: `${total} unread message${total === 1 ? "" : "s"} in ${appName}`,
        html: `
            <p>Hi ${escapeHtml(recipientName)},</p>
            <p>You have <strong>${total}</strong> unread message${total === 1 ? "" : "s"} waiting in ${appName}:</p>
            <ul>${rows}</ul>
            <p><a href="${appUrl}">Open ${appName}</a></p>
            <p style="color:#888;font-size:12px">You're getting this because the nightly digest is on. Turn it off in Settings → Notifications.</p>
        `
    };
}

export function magicLinkEmail(url: string, appName: string): { subject: string; html: string } {
    return {
        subject: `Your ${appName} sign-in link`,
        html: `
            <p>Click the link below to sign in to ${appName}:</p>
            <p><a href="${url}">Sign in to ${appName}</a></p>
            <p>This link expires shortly. If you didn't request it, you can ignore this email.</p>
        `
    };
}

export function verificationEmail(url: string, appName: string): { subject: string; html: string } {
    return {
        subject: `Verify your ${appName} email`,
        html: `
            <p>Welcome to ${appName}! Please verify your email address:</p>
            <p><a href="${url}">Verify email</a></p>
        `
    };
}

export function changeEmailConfirmationEmail(
    url: string,
    appName: string,
    newEmail: string
): { subject: string; html: string } {
    return {
        subject: `Confirm your ${appName} email change`,
        html: `
            <p>We received a request to change your ${appName} email address to <strong>${newEmail}</strong>.</p>
            <p><a href="${url}">Confirm email change</a></p>
            <p>If you didn't request this, you can ignore this email — your address won't change.</p>
        `
    };
}

export function resetPasswordEmail(
    url: string,
    appName: string
): { subject: string; html: string } {
    return {
        subject: `Reset your ${appName} password`,
        html: `
            <p>We received a request to reset your ${appName} password. Click the link below to choose a new one:</p>
            <p><a href="${url}">Reset password</a></p>
            <p>This link expires shortly. If you didn't request a password reset, you can ignore this email.</p>
        `
    };
}
