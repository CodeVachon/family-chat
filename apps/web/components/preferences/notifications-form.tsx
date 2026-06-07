"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateNotifications } from "@/lib/actions/preferences";
import { NOTIFICATION_LEVELS, type NotificationLevel } from "@/lib/validation/preferences";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

const LEVEL_LABELS: Record<NotificationLevel, string> = {
    all: "All new messages",
    mentions: "Only when I'm mentioned",
    none: "Nothing"
};

export function NotificationsForm({
    initial
}: {
    initial: { notificationLevel: NotificationLevel };
}) {
    const router = useRouter();
    const [level, setLevel] = useState<NotificationLevel>(initial.notificationLevel);
    const [pending, setPending] = useState(false);
    // Set once the user acts on desktop notifications (we don't read it on mount
    // to keep this SSR-safe and avoid cascading effects).
    const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);

    async function save() {
        setPending(true);
        try {
            await updateNotifications({ notificationLevel: level });
            toast.success("Notification settings updated");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save");
        } finally {
            setPending(false);
        }
    }

    async function enableDesktop() {
        if (typeof Notification === "undefined") {
            toast.error("Your browser doesn't support notifications");
            return;
        }
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === "granted") toast.success("Desktop notifications enabled");
        else toast.error("Permission was not granted");
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <Label>Notify me about</Label>
                <RadioGroup value={level} onValueChange={(v) => setLevel(String(v) as NotificationLevel)}>
                    {NOTIFICATION_LEVELS.map((l) => (
                        <label key={l} className="flex cursor-pointer items-center gap-2 text-sm">
                            <RadioGroupItem value={l} />
                            {LEVEL_LABELS[l]}
                        </label>
                    ))}
                </RadioGroup>
            </div>

            <div className="flex flex-col gap-2">
                <Label>Desktop notifications</Label>
                {permission === "granted" ? (
                    <p className="text-sm text-muted-foreground">
                        Desktop notifications are enabled for this browser.
                    </p>
                ) : permission === "unsupported" ? (
                    <p className="text-sm text-muted-foreground">
                        This browser doesn&apos;t support desktop notifications.
                    </p>
                ) : (
                    <div className="flex flex-col items-start gap-1">
                        <Button type="button" variant="outline" onClick={enableDesktop}>
                            Enable desktop notifications
                        </Button>
                        {permission === "denied" && (
                            <p className="text-xs text-muted-foreground">
                                Blocked — re-enable notifications for this site in your browser settings.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div>
                <Button onClick={() => void save()} disabled={pending}>
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
