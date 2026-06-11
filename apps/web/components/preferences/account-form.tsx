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

    const [newEmail, setNewEmail] = useState("");
    const [emailPending, setEmailPending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    async function handleEmailSubmit(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = newEmail.trim();
        if (!trimmed || trimmed === email) {
            toast.error("Enter a different email address.");
            return;
        }
        setEmailPending(true);
        const { error } = await authClient.changeEmail({
            newEmail: trimmed,
            callbackURL: "/settings/account"
        });
        setEmailPending(false);
        if (error) {
            toast.error(error.message ?? "Couldn't request the email change.");
            return;
        }
        // The change only commits once the link sent to the CURRENT address is
        // clicked. (Better-Auth silently no-ops a change to an in-use address.)
        setEmailSent(true);
        setNewEmail("");
    }

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
        <div data-component="AccountForm" className="flex flex-col gap-6">
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <Label>Email</Label>
                    <p className="text-sm text-muted-foreground">{email}</p>
                </div>
                <TextField
                    id="newEmail"
                    label="New email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                />
                {emailSent && (
                    <p className="text-sm text-muted-foreground">
                        Check your current inbox ({email}) for a link to confirm the change. Your
                        email won&apos;t change until you click it.
                    </p>
                )}
                <div>
                    <Button type="submit" variant="outline" disabled={emailPending}>
                        {emailPending ? "Sending…" : "Update email"}
                    </Button>
                </div>
            </form>

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
