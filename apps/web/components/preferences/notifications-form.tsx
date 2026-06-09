"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateNotifications } from "@/lib/actions/preferences";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push/subscribe-client";
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
    // Set once the user acts on push (we don't read it on mount to keep this
    // SSR-safe and avoid cascading effects).
    const [pushState, setPushState] = useState<"granted" | "denied" | "unsupported" | "error" | null>(
        null
    );
    const [pushBusy, setPushBusy] = useState(false);

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

    async function enablePush() {
        setPushBusy(true);
        const result = await subscribeToPush();
        setPushState(result);
        setPushBusy(false);
        if (result === "granted") toast.success("Background notifications enabled on this device");
        else if (result === "denied") toast.error("Permission was not granted");
        else if (result === "unsupported")
            toast.error("This browser doesn't support background notifications");
        else toast.error("Couldn't enable notifications");
    }

    async function disablePush() {
        setPushBusy(true);
        await unsubscribeFromPush();
        setPushState(null);
        setPushBusy(false);
        toast.success("Background notifications disabled on this device");
    }

    return (
        <div data-component="NotificationsForm" className="flex flex-col gap-6">
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
                <Label>Background notifications</Label>
                <p className="text-sm text-muted-foreground">
                    Get notified on this device even when the app is closed.
                </p>
                {pushState === "granted" ? (
                    <div className="flex flex-col items-start gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={pushBusy}
                            onClick={() => void disablePush()}
                        >
                            Disable on this device
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-start gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={pushBusy}
                            onClick={() => void enablePush()}
                        >
                            {pushBusy ? "Enabling…" : "Enable on this device"}
                        </Button>
                        {pushState === "denied" && (
                            <p className="text-xs text-muted-foreground">
                                Blocked — re-enable notifications for this site in your browser settings.
                            </p>
                        )}
                        {pushState === "unsupported" && (
                            <p className="text-xs text-muted-foreground">
                                On iPhone/iPad, first add this app to your Home Screen, then enable.
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
