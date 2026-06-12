"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateAppearance } from "@/lib/actions/preferences";
import {
    DATE_TIME_FORMATS,
    FONT_FAMILIES,
    FONT_SIZE_SCALES,
    THEME_OPTIONS,
    type DateTimeFormat,
    type FontFamily,
    type FontSizeScale,
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

const FONT_SIZE_LABELS: Record<FontSizeScale, string> = {
    small: "Small",
    default: "Default",
    large: "Large",
    xlarge: "Extra large"
};

const FONT_FAMILY_LABELS: Record<FontFamily, string> = {
    figtree: "Figtree (default)",
    inter: "Inter",
    "open-sans": "Open Sans",
    "nunito-sans": "Nunito Sans",
    atkinson: "Atkinson Hyperlegible (high legibility)"
};

// Live-apply helpers: mirror the html data attributes the root layout sets
// server-side, so the whole UI updates as the user tries options (pre-save).
function applyFontSize(value: FontSizeScale) {
    document.documentElement.dataset.fontSize = value;
}
function applyFontFamily(value: FontFamily) {
    document.documentElement.dataset.fontFamily = value;
}

export function AppearanceForm({
    initial
}: {
    initial: {
        themePreference: ThemeOption;
        dateTimeFormat: DateTimeFormat;
        fontSizeScale: FontSizeScale;
        fontFamily: FontFamily;
    };
}) {
    const router = useRouter();
    const { setTheme } = useTheme();
    const [theme, setThemeState] = useState<ThemeOption>(initial.themePreference);
    const [format, setFormat] = useState<DateTimeFormat>(initial.dateTimeFormat);
    const [fontSize, setFontSize] = useState<FontSizeScale>(initial.fontSizeScale);
    const [fontFamily, setFontFamily] = useState<FontFamily>(initial.fontFamily);
    const [pending, setPending] = useState(false);

    function onThemeChange(value: string) {
        const next = value as ThemeOption;
        setThemeState(next);
        setTheme(next); // apply immediately
    }

    function onFontSizeChange(value: string) {
        const next = value as FontSizeScale;
        setFontSize(next);
        applyFontSize(next); // apply immediately
    }

    function onFontFamilyChange(value: string) {
        const next = value as FontFamily;
        setFontFamily(next);
        applyFontFamily(next); // apply immediately
    }

    async function save() {
        setPending(true);
        try {
            await updateAppearance({
                themePreference: theme,
                dateTimeFormat: format,
                fontSizeScale: fontSize,
                fontFamily
            });
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

            <div className="flex flex-col gap-3">
                <Label>Text size</Label>
                <p className="text-sm text-muted-foreground">
                    Scales the whole app. Larger sizes can help readability.
                </p>
                <RadioGroup value={fontSize} onValueChange={onFontSizeChange}>
                    {FONT_SIZE_SCALES.map((o) => (
                        <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                            <RadioGroupItem value={o} />
                            {FONT_SIZE_LABELS[o]}
                        </label>
                    ))}
                </RadioGroup>
            </div>

            <div className="flex flex-col gap-3">
                <Label>Font</Label>
                <RadioGroup value={fontFamily} onValueChange={onFontFamilyChange}>
                    {FONT_FAMILIES.map((o) => (
                        <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                            <RadioGroupItem value={o} />
                            {FONT_FAMILY_LABELS[o]}
                        </label>
                    ))}
                </RadioGroup>
                <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm text-muted-foreground">Preview</p>
                    <p className="font-sans">The quick brown fox jumps over the lazy dog.</p>
                </div>
            </div>

            <div>
                <Button onClick={() => void save()} disabled={pending}>
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}
