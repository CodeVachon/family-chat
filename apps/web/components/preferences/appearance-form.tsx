"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateAppearance } from "@/lib/actions/preferences";
import {
    DATE_TIME_FORMATS,
    THEME_OPTIONS,
    type DateTimeFormat,
    type ThemeOption
} from "@/lib/validation/preferences";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";

const THEME_LABELS: Record<ThemeOption, string> = {
    system: "System",
    light: "Light",
    dark: "Dark"
};

const FORMAT_LABELS: Record<DateTimeFormat, string> = {
    relative: "Relative (5m ago)",
    "12h": "12-hour (3:42 PM)",
    "24h": "24-hour (15:42)"
};

export function AppearanceForm({
    initial
}: {
    initial: { themePreference: ThemeOption; dateTimeFormat: DateTimeFormat };
}) {
    const router = useRouter();
    const { setTheme } = useTheme();
    const [theme, setThemeState] = useState<ThemeOption>(initial.themePreference);
    const [format, setFormat] = useState<DateTimeFormat>(initial.dateTimeFormat);
    const [pending, setPending] = useState(false);

    function onThemeChange(value: string) {
        const next = value as ThemeOption;
        setThemeState(next);
        setTheme(next); // apply immediately
    }

    async function save() {
        setPending(true);
        try {
            await updateAppearance({ themePreference: theme, dateTimeFormat: format });
            toast.success("Appearance updated");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save");
        } finally {
            setPending(false);
        }
    }

    return (
        <div data-component="AppearanceForm" className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <Label>Theme</Label>
                <RadioGroup value={theme} onValueChange={(v) => onThemeChange(String(v))}>
                    {THEME_OPTIONS.map((o) => (
                        <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                            <RadioGroupItem value={o} />
                            {THEME_LABELS[o]}
                        </label>
                    ))}
                </RadioGroup>
            </div>

            <div className="flex flex-col gap-3">
                <Label>Date &amp; time format</Label>
                <RadioGroup
                    value={format}
                    onValueChange={(v) => setFormat(String(v) as DateTimeFormat)}
                >
                    {DATE_TIME_FORMATS.map((o) => (
                        <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                            <RadioGroupItem value={o} />
                            {FORMAT_LABELS[o]}
                        </label>
                    ))}
                </RadioGroup>
            </div>

            <div>
                <Button onClick={() => void save()} disabled={pending}>
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
