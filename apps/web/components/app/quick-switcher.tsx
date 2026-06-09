"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ChannelIcon } from "@/components/channels/channel-icon";
import type { SidebarChannel } from "@/components/channels/channel-list";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@workspace/ui/components/command";
import { CommandDialog } from "@workspace/ui/components/command";

export function QuickSwitcher({ channels }: { channels: SidebarChannel[] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    function go(id: string) {
        setOpen(false);
        router.push(`/channels/${id}`);
    }

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            title="Switch channel"
            description="Jump to a channel"
        >
            <Command>
                <CommandInput placeholder="Jump to a channel…" />
                <CommandList>
                    <CommandEmpty>No channels found.</CommandEmpty>
                    <CommandGroup heading="Channels">
                        {channels.map((c) => (
                            <CommandItem key={c.id} value={c.name} onSelect={() => go(c.id)}>
                                <ChannelIcon icon={c.icon} color={c.color} className="size-4" />
                                {c.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        </CommandDialog>
    );
}
