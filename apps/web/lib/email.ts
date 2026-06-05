import "server-only";

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Family Chat <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

type SendArgs = {
    to: string;
    subject: string;
    html: string;
};

/**
 * Sends an email via Resend. In development without a RESEND_API_KEY configured
 * we log to the console instead of failing, so auth flows remain testable.
 */
export async function sendEmail({ to, subject, html }: SendArgs): Promise<void> {
    if (!resend) {
        console.warn(
            `[email] RESEND_API_KEY not set — skipping send.\n  to: ${to}\n  subject: ${subject}`
        );
        return;
    }

    const { error } = await resend.emails.send({ from, to, subject, html });

    if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

export function magicLinkEmail(url: string): { subject: string; html: string } {
    return {
        subject: "Your Family Chat sign-in link",
        html: `
            <p>Click the link below to sign in to Family Chat:</p>
            <p><a href="${url}">Sign in to Family Chat</a></p>
            <p>This link expires shortly. If you didn't request it, you can ignore this email.</p>
        `
    };
}

export function verificationEmail(url: string): { subject: string; html: string } {
    return {
        subject: "Verify your Family Chat email",
        html: `
            <p>Welcome to Family Chat! Please verify your email address:</p>
            <p><a href="${url}">Verify email</a></p>
        `
    };
}
