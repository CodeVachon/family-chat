"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/auth/text-field";
import { authClient } from "@/lib/auth-client";
import type { UserPasskey } from "@/lib/queries/account";
import { Button } from "@workspace/ui/components/button";

/** Whether this browser supports the WebAuthn APIs the passkey flow needs. */
function passkeysSupported(): boolean {
    return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

export function PasskeyManager({ passkeys }: { passkeys: UserPasskey[] }) {
    const router = useRouter();
    const [name, setName] = useState("");
    const [adding, setAdding] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const supported = passkeysSupported();

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        setAdding(true);
        const result = await authClient.passkey.addPasskey({
            name: name.trim() || undefined
        });
        setAdding(false);
        // addPasskey resolves to undefined on success; an object with `error`
        // on failure. A user who dismisses the OS prompt also lands here.
        if (result?.error) {
            toast.error(result.error.message ?? "Couldn't add passkey");
            return;
        }
        toast.success("Passkey added");
        setName("");
        router.refresh();
    }

    async function handleRemove(id: string) {
        setRemovingId(id);
        const { error } = await authClient.passkey.deletePasskey({ id });
        setRemovingId(null);
        if (error) {
            toast.error(error.message ?? "Couldn't remove passkey");
            return;
        }
        toast.success("Passkey removed");
        router.refresh();
    }

    return (
        <div data-component="PasskeyManager" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h3 className="font-medium">Passkeys</h3>
                <p className="text-sm text-muted-foreground">
                    Sign in with Face ID, Touch ID, or a security key — no password needed.
                </p>
            </div>

            {passkeys.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {passkeys.map((pk) => (
                        <li
                            key={pk.id}
                            className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate text-sm">
                                    {pk.name?.trim() || "Passkey"}
                                </span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={removingId === pk.id}
                                onClick={() => handleRemove(pk.id)}
                                aria-label="Remove passkey"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {supported ? (
                <form onSubmit={handleAdd} className="flex flex-col gap-3">
                    <TextField
                        id="passkeyName"
                        label="Passkey name (optional)"
                        placeholder="e.g. My laptop"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <div>
                        <Button type="submit" variant="outline" disabled={adding}>
                            {adding ? "Waiting for device…" : "Add a passkey"}
                        </Button>
                    </div>
                </form>
            ) : (
                <p className="text-sm text-muted-foreground">
                    This browser doesn&apos;t support passkeys.
                </p>
            )}
        </div>
    );
}
