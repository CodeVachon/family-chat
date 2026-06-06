"use client";

import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

export function AccountForm({ email }: { email: string }) {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [pending, setPending] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (next.length < 8) {
            toast.error("New password must be at least 8 characters");
            return;
        }
        setPending(true);
        const { error } = await authClient.changePassword({
            currentPassword: current,
            newPassword: next
        });
        setPending(false);
        if (error) {
            toast.error(error.message ?? "Couldn't change password");
            return;
        }
        toast.success("Password changed");
        setCurrent("");
        setNext("");
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground">{email}</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <TextField
                    id="current"
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                />
                <TextField
                    id="new"
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                />
                <div>
                    <Button type="submit" disabled={pending}>
                        {pending ? "Saving…" : "Change password"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
