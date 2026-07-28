"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ChannelDialog } from "@/components/channels/channel-dialog";

/**
 * Opens the channel-settings dialog when `?settings=1` is on the URL.
 *
 * Follows the pattern the channel page already uses for `?thread=` and
 * `?profile=`: the entry point is a plain link, the dialog survives a refresh, and
 * Back closes it. The header's menu item needs this because a `DialogTrigger`
 * nested inside a dropdown item is unreliable — the menu unmounts on select.
 */
export function ChannelSettingsFromUrl({
    channel
}: {
    channel: {
        id: string;
        name: string;
        description: string | null;
        color: string | null;
        icon: string | null;
        isPrivate: boolean;
        isArchived: boolean;
    };
}) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const open = params.get("settings") === "1";

    const close = () => {
        const next = new URLSearchParams(params);
        next.delete("settings");
        const query = next.toString();
        // `replace`, so dismissing the dialog doesn't leave a history entry that
        // Back would land on and immediately reopen.
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    };

    return (
        <ChannelDialog
            channel={channel}
            open={open}
            onOpenChange={(next) => {
                if (!next) close();
            }}
        />
    );
}
