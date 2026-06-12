"use client";

import { Menu } from "lucide-react";
import { createContext, useContext, useState } from "react";

import { cn } from "@workspace/ui/lib/utils";

type MobileSidebarValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

const MobileSidebarContext = createContext<MobileSidebarValue | null>(null);

export function useMobileSidebar(): MobileSidebarValue {
    const ctx = useContext(MobileSidebarContext);
    if (!ctx) throw new Error("useMobileSidebar must be used within a MobileSidebarProvider");
    return ctx;
}

/** Owns the open state for the mobile sidebar drawer so the toggle and the
 * drawer itself can live in different parts of the tree. */
export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
        <MobileSidebarContext.Provider value={{ open, setOpen }}>
            {children}
        </MobileSidebarContext.Provider>
    );
}

/** Opens the mobile sidebar drawer. Place anywhere inside the provider — e.g.
 * the channel header (mobile) or a top-level page header. */
export function SidebarToggle({ className }: { className?: string }) {
    const { setOpen } = useMobileSidebar();
    return (
        <button
            data-component="SidebarToggle"
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted",
                className
            )}
        >
            <Menu className="size-5" />
        </button>
    );
}
