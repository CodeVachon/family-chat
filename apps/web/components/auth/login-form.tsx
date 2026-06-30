"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { useResendVerification } from "@/components/auth/use-resend-verification";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";

export function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [magicPending, setMagicPending] = useState(false);
    const [verifyNeeded, setVerifyNeeded] = useState(false);
    const { resending, resend } = useResendVerification(email);

    async function handlePasswordLogin(e: React.FormEvent) {
        e.preventDefault();
        setPending(true);
        setVerifyNeeded(false);
        const { error } = await authClient.signIn.email({ email, password, callbackURL: "/" });
        setPending(false);
        if (error) {
            if (error.code === "EMAIL_NOT_VERIFIED") {
                setVerifyNeeded(true);
                return;
            }
            toast.error(error.message ?? "Could not sign in.");
            return;
        }
        router.push("/");
        router.refresh();
    }

    async function handleMagicLink() {
        if (!email) {
            toast.error("Enter your email first.");
            return;
        }
        setMagicPending(true);
        const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/" });
        setMagicPending(false);
        if (error) {
            toast.error(error.message ?? "Could not send magic link.");
            return;
        }
        toast.success("Check your email for a sign-in link.");
    }

    return (
        <form
            data-component="LoginForm"
            onSubmit={handlePasswordLogin}
            className="flex flex-col gap-4"
        >
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
            </Button>
            {verifyNeeded && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-400/10 p-3 text-sm">
                    <p>Verify your email before signing in. Check your inbox for the link.</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={resend}
                        disabled={resending}
                    >
                        {resending ? "Sending…" : "Resend verification email"}
                    </Button>
                </div>
            )}
            <div className="relative my-1 text-center text-xs text-muted-foreground">
                <span className="bg-card px-2">or</span>
                <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
            </div>
            <Button
                type="button"
                variant="outline"
                onClick={handleMagicLink}
                disabled={magicPending}
            >
                {magicPending ? "Sending…" : "Email me a magic link"}
            </Button>
        </form>
    );
}
