"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { inviteUser } from "@/lib/actions/admin";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";

export function InviteUserForm() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [pending, setPending] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setPending(true);
        try {
            await inviteUser({ name, email });
            toast.success("Invite sent — a magic sign-in link is on its way");
            setName("");
            setEmail("");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't send invite");
        } finally {
            setPending(false);
        }
    }

    return (
        <Card className="mb-4">
            <CardContent className="py-4">
                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                >
                    <div className="flex-1">
                        <TextField
                            id="inviteName"
                            label="Name"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="flex-1">
                        <TextField
                            id="inviteEmail"
                            label="Email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <Button type="submit" disabled={pending || !name.trim() || !email.trim()}>
                        {pending ? "Inviting…" : "Invite"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
