"use client";

import { ChevronsUpDown, LogOut, Settings, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { UserAvatar, UserName } from "@/components/user/user-identity";
import { authClient } from "@/lib/auth-client";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@workspace/ui/components/dropdown-menu";

export function UserMenu({
    user,
    canAccessAdmin,
    pendingApprovals = 0,
    onNavigate
}: {
    user: { name: string; email: string; colorHue: number; avatarUrl: string | null };
    canAccessAdmin: boolean;
    pendingApprovals?: number;
    onNavigate?: () => void;
}) {
    const router = useRouter();
    // Pending approvals are an admin-only action; non-staff never see the badge.
    const showApprovals = canAccessAdmin && pendingApprovals > 0;
    const badgeLabel = pendingApprovals > 99 ? "99+" : String(pendingApprovals);

    function navigate(href: string) {
        onNavigate?.();
        router.push(href);
    }

    async function signOut() {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted"
                aria-label={
                    showApprovals
                        ? `Account menu — ${pendingApprovals} pending approval${pendingApprovals === 1 ? "" : "s"}`
                        : "Account menu"
                }
            >
                <span className="relative shrink-0">
                    <UserAvatar
                        name={user.name}
                        colorHue={user.colorHue}
                        avatarUrl={user.avatarUrl}
                    />
                    {showApprovals && (
                        <span
                            aria-hidden
                            className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-card"
                        />
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <UserName
                        name={user.name}
                        colorHue={user.colorHue}
                        className="block truncate text-sm"
                    />
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="size-4" />
                    Settings
                </DropdownMenuItem>
                {canAccessAdmin && (
                    <DropdownMenuItem
                        onClick={() => navigate(showApprovals ? "/admin/approvals" : "/admin")}
                    >
                        <ShieldCheck className="size-4" />
                        Admin
                        {showApprovals && (
                            <span
                                className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white"
                                title={`${pendingApprovals} pending approval${pendingApprovals === 1 ? "" : "s"}`}
                            >
                                {badgeLabel}
                            </span>
                        )}
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={signOut}>
                    <LogOut className="size-4" />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
