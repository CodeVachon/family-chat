import "server-only";

import { db } from "@workspace/db/client";
import * as schema from "@workspace/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { count } from "drizzle-orm";

import { magicLinkEmail, sendEmail, verificationEmail } from "./email";

export const auth = betterAuth({
    appName: "Family Chat",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
        // Our tables are singular (`user`, `session`, ...), matching the schema.
        usePlural: false
    }),

    emailAndPassword: {
        enabled: true,
        // The admin approval gate is the real access control, so we don't block
        // sign-in on email verification. A verification email is still available.
        requireEmailVerification: false,
        sendResetPassword: async ({ user, url }) => {
            const { subject, html } = verificationEmail(url);
            await sendEmail({ to: user.email, subject, html });
        }
    },

    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            const { subject, html } = verificationEmail(url);
            await sendEmail({ to: user.email, subject, html });
        }
    },

    // Custom application fields exposed on the session. `input: false` keeps them
    // out of user-controlled signup payloads — they're set server-side only.
    user: {
        additionalFields: {
            appRole: {
                type: "string",
                required: false,
                defaultValue: "user",
                input: false
            },
            approvalStatus: {
                type: "string",
                required: false,
                defaultValue: "pending",
                input: false
            }
        }
    },

    session: {
        // Short-lived cookie cache lets proxy.ts make optimistic redirect
        // decisions without a DB hit; the DAL remains the authoritative check.
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60
        }
    },

    databaseHooks: {
        user: {
            create: {
                // The very first user to sign up becomes the single application
                // Owner and is auto-approved. Everyone else starts pending.
                before: async (user) => {
                    const [row] = await db.select({ value: count() }).from(schema.user);
                    const isFirstUser = (row?.value ?? 0) === 0;

                    if (isFirstUser) {
                        return {
                            data: {
                                ...user,
                                appRole: "owner",
                                approvalStatus: "approved",
                                approvedAt: new Date()
                            }
                        };
                    }

                    return { data: user };
                }
            }
        }
    },

    plugins: [
        magicLink({
            sendMagicLink: async ({ email, url }) => {
                const { subject, html } = magicLinkEmail(url);
                await sendEmail({ to: email, subject, html });
            }
        }),
        // nextCookies() must be last so server actions can set the session cookie.
        nextCookies()
    ]
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
