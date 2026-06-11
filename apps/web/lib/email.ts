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
