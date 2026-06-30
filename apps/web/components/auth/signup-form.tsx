"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { useResendVerification } from "@/components/auth/use-resend-verification";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";

export function SignupForm() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [verifySent, setVerifySent] = useState(false);
    const { resending, resend } = useResendVerification(email);

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        if (password.length < 8) {
            toast.error("Password must be at least 8 characters.");
            return;
        }
        setPending(true);
        const { error: signUpError } = await authClient.signUp.email({
            name,
            email,
            password,
            callbackURL: "/"
        });
        if (signUpError) {
            setPending(false);
            toast.error(signUpError.message ?? "Could not create account.");
            return;
        }

        // Sign-up requires email verification, so no session is created yet and a
        // verification email has been sent. Attempt a sign-in: the exempt owner
        // (auto-verified) goes straight in; everyone else is unverified and is
        // shown the "verify your email" prompt.
        const { error: signInError } = await authClient.signIn.email({
            email,
            password,
            callbackURL: "/"
        });
        setPending(false);
        if (signInError) {
            if (signInError.code === "EMAIL_NOT_VERIFIED") {
                setVerifySent(true);
                return;
            }
            toast.error(signInError.message ?? "Could not sign in.");
            return;
        }
        // Owner / already-verified: proxy + DAL route them onward.
        router.push("/");
        router.refresh();
    }

    if (verifySent) {
        return (
            <div data-component="SignupForm" className="flex flex-col gap-4 text-sm">
                <p className="font-medium">Check your email</p>
                <p className="text-muted-foreground">
                    We sent a verification link to <span className="font-medium">{email}</span>.
                    Click it to verify your address — then an administrator will review your account
                    for access.
                </p>
                <Button type="button" variant="outline" onClick={resend} disabled={resending}>
                    {resending ? "Sending…" : "Resend verification email"}
                </Button>
            </div>
        );
    }

    return (
        <form data-component="SignupForm" onSubmit={handleSignup} className="flex flex-col gap-4">
            <TextField
                id="name"
                label="Name"
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <TextField
                id="email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
                id="password"
                label="Password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={pending}>
                {pending ? "Creating account…" : "Create account"}
            </Button>
        </form>
    );
}
