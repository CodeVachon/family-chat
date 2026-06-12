"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { updateNotifications } from "@/lib/actions/preferences";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push/subscribe-client";
import { NOTIFICATION_LEVELS, type NotificationLevel } from "@/lib/validation/preferences";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { Switch } from "@workspace/ui/components/switch";

const LEVEL_LABELS: Record<NotificationLevel, string> = {
    all: "All new messages",
    mentions: "Only when I'm mentioned",
    none: "Nothing"
};

export function NotificationsForm({
    initial
}: {
    initial: {
        notificationLevel: NotificationLevel;
        dailyDigestEnabled: boolean;
        timezone: string | null;
    };
}) {
    const router = useRouter();
    const [level, setLevel] = useState<NotificationLevel>(initial.notificationLevel);
    const [digest, setDigest] = useState(initial.dailyDigestEnabled);
    const [timezone, setTimezone] = useState(initial.timezone);
    const [zones, setZones] = useState<string[]>([]);
    const [pending, setPending] = useState(false);

    // Populate the zone list and default-fill the picker with the device zone
    // client-side (avoids an SSR/CSR hydration mismatch on the detected value).
    useEffect(() => {
        try {
            setZones(Intl.supportedValuesOf("timeZone"));
        } catch {
            setZones([]);
        }
        if (!timezone) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) setTimezone(tz);
        }
        // Only on mount; later edits come from the picker.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ensure the stored value is always selectable even if it's not in the list.
    const tzOptions = useMemo(() => {
        const set = new Set(zones);
        if (timezone) set.add(timezone);
        return [...set];
    }, [zones, timezone]);
    // Set once the user acts on push (we don't read it on mount to keep this
    // SSR-safe and avoid cascading effects).
    const [pushState, setPushState] = useState<
        "granted" | "denied" | "unsupported" | "error" | null
    >(null);
    const [pushBusy, setPushBusy] = useState(false);

    async function save() {
        setPending(true);
        try {
            await updateNotifications({
                notificationLevel: level,
                dailyDigestEnabled: digest,
                timezone: timezone || null
            });
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
                <RadioGroup
                    value={level}
                    onValueChange={(v) => setLevel(String(v) as NotificationLevel)}
                >
                    {NOTIFICATION_LEVELS.map((l) => (
                        <label key={l} className="flex cursor-pointer items-center gap-2 text-sm">
                            <RadioGroupItem value={l} />
                            {LEVEL_LABELS[l]}
                        </label>
                    ))}
                </RadioGroup>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <Label>Nightly digest email</Label>
                        <p className="text-sm text-muted-foreground">
                            A summary of your unread messages, emailed at midnight in your time
                            zone. Off unless you turn it on; skipped when you have nothing unread.
                        </p>
                    </div>
                    <Switch
                        checked={digest}
                        onCheckedChange={setDigest}
                        aria-label="Nightly digest email"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="timezone">Time zone</Label>
                    <select
                        id="timezone"
                        value={timezone ?? ""}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="h-9 rounded-md border bg-background px-3 text-sm shadow-xs"
                    >
                        {!timezone && <option value="">Select a time zone…</option>}
                        {tzOptions.map((z) => (
                            <option key={z} value={z}>
                                {z}
                            </option>
                        ))}
                    </select>
                </div>
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
                                Blocked — re-enable notifications for this site in your browser
                                settings.
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
