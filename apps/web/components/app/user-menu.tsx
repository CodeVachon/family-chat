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
    onNavigate
}: {
    user: { name: string; email: string; colorHue: number; avatarUrl: string | null };
    canAccessAdmin: boolean;
    onNavigate?: () => void;
}) {
    const router = useRouter();

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
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted">
                <UserAvatar name={user.name} colorHue={user.colorHue} avatarUrl={user.avatarUrl} />
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
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <ShieldCheck className="size-4" />
                        Admin
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
