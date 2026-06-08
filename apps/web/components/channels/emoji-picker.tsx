"use client";

import { EmojiPicker as Frimousse } from "frimousse";
import { Smile } from "lucide-react";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

/** Emoji picker (frimousse) in a popover. Calls `onSelect` with the chosen emoji character. */
export function EmojiPicker({
    onSelect,
    disabled
}: {
    onSelect: (emoji: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                aria-label="Insert emoji"
                disabled={disabled}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
                <Smile className="size-4" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Frimousse.Root
                    className="isolate flex h-[320px] w-[300px] flex-col bg-popover"
                    onEmojiSelect={({ emoji }) => {
                        onSelect(emoji);
                        setOpen(false);
                    }}
                >
                    <Frimousse.Search className="z-10 mx-2 mt-2 appearance-none rounded-md border bg-muted px-2.5 py-2 text-sm outline-none" />
                    <Frimousse.Viewport className="relative flex-1 outline-hidden">
                        <Frimousse.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                            Loading…
                        </Frimousse.Loading>
                        <Frimousse.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                            No emoji found.
                        </Frimousse.Empty>
                        <Frimousse.List
                            className="select-none pb-1.5"
                            components={{
                                CategoryHeader: ({ category, ...props }) => (
                                    <div
                                        className="bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground"
                                        {...props}
                                    >
                                        {category.label}
                                    </div>
                                ),
                                Row: ({ children, ...props }) => (
                                    <div className="scroll-my-1.5 px-1.5" {...props}>
                                        {children}
                                    </div>
                                ),
                                Emoji: ({ emoji, ...props }) => (
                                    <button
                                        className="flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-muted"
                                        {...props}
                                    >
                                        {emoji.emoji}
                                    </button>
                                )
                            }}
                        />
                    </Frimousse.Viewport>
                </Frimousse.Root>
            </PopoverContent>
        </Popover>
    );
}
