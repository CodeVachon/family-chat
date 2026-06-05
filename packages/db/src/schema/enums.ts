import { pgEnum } from "drizzle-orm/pg-core";

/** Application-wide role. The first user to sign up becomes the single `owner`. */
export const appRole = pgEnum("app_role", ["owner", "admin", "user"]);

/** Signup approval gate. New users start `pending` and cannot see channels. */
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected"]);

/** Per-channel role. The channel creator is the single `owner`. */
export const channelRole = pgEnum("channel_role", ["owner", "admin", "user", "viewer"]);
