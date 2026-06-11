import { pgEnum } from "drizzle-orm/pg-core";

/** Application-wide role. The first user to sign up becomes the single `owner`. */
export const appRole = pgEnum("app_role", ["owner", "admin", "user"]);

/** Signup approval gate. New users start `pending` and cannot see channels. */
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected"]);

/** Per-channel role. The channel creator is the single `owner`. */
export const channelRole = pgEnum("channel_role", ["owner", "admin", "user", "viewer"]);

/**
 * Message kind. `user` is a normal authored message; `system` is an inline
 * channel announcement (e.g. a join/leave notice) that isn't editable,
 * deletable, or reactable.
 */
export const messageType = pgEnum("message_type", ["user", "system"]);
