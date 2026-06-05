"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";

export function SignupForm() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();
        if (password.length < 8) {
            toast.error("Password must be at least 8 characters.");
            return;
        }
        setPending(true);
        const { error } = await authClient.signUp.email({
            name,
            email,
            password,
            callbackURL: "/"
        });
        setPending(false);
        if (error) {
            toast.error(error.message ?? "Could not create account.");
            return;
        }
        // New accounts are pending approval; proxy + DAL route them to /pending.
        router.push("/");
        router.refresh();
    }

    return (
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
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
