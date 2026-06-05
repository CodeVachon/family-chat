/**
 * Pure authorization functions for both RBAC layers. No I/O — callers pass in
 * the actor's app role, their channel membership (if any), and channel state.
 * Mirrors the enum unions in @workspace/db without importing the schema, so it
 * stays usable on the client for optimistic UI gating.
 *
 * Rules are expressed as data (lookup tables) rather than branchy switches so
 * the policy is easy to read, audit, and extend.
 */

export type AppRole = "owner" | "admin" | "user";
export type ChannelRole = "owner" | "admin" | "user" | "viewer";

export type AppAction =
    | "user:approve"
    | "user:reject"
    | "user:promote_admin"
    | "user:demote"
    | "channel:create"
    | "app:transfer_ownership"
    | "tracker:manage";

export type ChannelAction =
    | "channel:view"
    | "channel:post"
    | "channel:edit_settings"
    | "channel:archive"
    | "channel:manage_members"
    | "channel:delete"
    | "thread:create"
    | "message:edit_own"
    | "message:edit_any"
    | "message:delete_any";

const isStaffRole = (role: AppRole): boolean => role === "owner" || role === "admin";
const isOwnerRole = (role: AppRole): boolean => role === "owner";

export function isAppStaff(actor: { appRole: AppRole }): boolean {
    return isStaffRole(actor.appRole);
}

/** App-level rules: each action maps to the roles that may perform it. */
const APP_ACTION_RULES: Record<AppAction, (role: AppRole) => boolean> = {
    // Any approved user may create a channel (and becomes its Owner).
    "channel:create": () => true,
    "user:approve": isStaffRole,
    "user:reject": isStaffRole,
    "tracker:manage": isStaffRole,
    "user:promote_admin": isOwnerRole,
    "user:demote": isOwnerRole,
    "app:transfer_ownership": isOwnerRole
};

/** Application-level capability check. */
export function canApp(actor: { appRole: AppRole }, action: AppAction): boolean {
    return APP_ACTION_RULES[action](actor.appRole);
}

const POSTING_ROLES: readonly ChannelRole[] = ["owner", "admin", "user"];
const MANAGEMENT_ROLES: readonly ChannelRole[] = ["owner", "admin"];

type ChannelRule = { roles: readonly ChannelRole[]; requiresActive?: boolean };

/**
 * Per-channel rules: required roles, and whether the channel must be active.
 * `channel:view` and `channel:delete` are handled separately in canInChannel.
 */
const CHANNEL_ACTION_RULES: Record<
    Exclude<ChannelAction, "channel:delete" | "channel:view">,
    ChannelRule
> = {
    "channel:post": { roles: POSTING_ROLES, requiresActive: true },
    "thread:create": { roles: POSTING_ROLES, requiresActive: true },
    "message:edit_own": { roles: POSTING_ROLES, requiresActive: true },
    "channel:edit_settings": { roles: MANAGEMENT_ROLES },
    "channel:archive": { roles: MANAGEMENT_ROLES },
    "channel:manage_members": { roles: MANAGEMENT_ROLES },
    "message:edit_any": { roles: MANAGEMENT_ROLES },
    "message:delete_any": { roles: MANAGEMENT_ROLES }
};

/**
 * The role an actor effectively has in a channel. App Owner/Admin inherit
 * channel-admin capabilities everywhere, but keep `owner` only where they are
 * the actual channel owner.
 */
function effectiveChannelRole(
    actor: { appRole: AppRole },
    membership: { role: ChannelRole } | null
): ChannelRole | null {
    if (membership?.role === "owner") return "owner";
    if (isStaffRole(actor.appRole)) return "admin";
    return membership?.role ?? null;
}

/** Per-channel capability check combining app role and channel role. */
export function canInChannel(
    actor: { appRole: AppRole },
    membership: { role: ChannelRole } | null,
    channel: { isPrivate: boolean; isArchived: boolean },
    action: ChannelAction
): boolean {
    const role = effectiveChannelRole(actor, membership);

    if (action === "channel:view") {
        // Public channels are readable by any approved user; private channels
        // require a membership (or app staff, who get an effective role).
        return !channel.isPrivate || role !== null;
    }

    if (role === null) return false; // no access (e.g. private, non-member)

    if (action === "channel:delete") {
        // Channel Owner, or the application Owner, only.
        return role === "owner" || actor.appRole === "owner";
    }

    const rule = CHANNEL_ACTION_RULES[action];
    if (rule.requiresActive && channel.isArchived) return false;
    return rule.roles.includes(role);
}
