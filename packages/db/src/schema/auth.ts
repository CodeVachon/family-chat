import { sql } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex
} from "drizzle-orm/pg-core";

import { appRole, approvalStatus } from "./enums";

/**
 * Better-Auth core `user` table plus our custom application fields.
 *
 * Property names (e.g. `emailVerified`, `createdAt`) must match Better-Auth's
 * model field names — the Drizzle adapter maps by property key, not DB column.
 * Custom fields (`appRole`, `approvalStatus`, ...) are declared to Better-Auth
 * via `user.additionalFields` in apps/web/lib/auth.ts.
 */
export const user = pgTable(
    "user",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        email: text("email").notNull().unique(),
        emailVerified: boolean("email_verified").notNull().default(false),
        image: text("image"),

        // --- custom application fields ---
        appRole: appRole("app_role").notNull().default("user"),
        approvalStatus: approvalStatus("approval_status").notNull().default("pending"),
        approvedAt: timestamp("approved_at", { withTimezone: true }),
        approvedByUserId: text("approved_by_user_id"),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
    },
    (table) => [
        // Enforce a single application Owner at the DB layer: among rows where
        // app_role = 'owner', the value must be unique, so only one can exist.
        uniqueIndex("one_app_owner")
            .on(table.appRole)
            .where(sql`${table.appRole} = 'owner'`)
    ]
);

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    // Hashed password for email/password sign-in lives here (Better-Auth).
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

/** Email-verification AND magic-link tokens. */
export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

/**
 * WebAuthn passkeys (Better-Auth `@better-auth/passkey` plugin). Property names
 * must match the plugin's model field names — the Drizzle adapter maps by
 * property key, not DB column. `counter` is the authenticator sign count.
 */
export const passkey = pgTable(
    "passkey",
    {
        id: text("id").primaryKey(),
        name: text("name"),
        publicKey: text("public_key").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        credentialID: text("credential_id").notNull(),
        counter: integer("counter").notNull(),
        deviceType: text("device_type").notNull(),
        backedUp: boolean("backed_up").notNull(),
        transports: text("transports"),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
        aaguid: text("aaguid")
    },
    (table) => [
        index("passkey_user_id_idx").on(table.userId),
        index("passkey_credential_id_idx").on(table.credentialID)
    ]
);

export type User = typeof user.$inferSelect;
export type AppRole = User["appRole"];
export type ApprovalStatus = User["approvalStatus"];
