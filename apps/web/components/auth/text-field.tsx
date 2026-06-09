"use client";

import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function TextField({
    id,
    label,
    ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
    return (
        <div data-component="TextField" className="flex flex-col gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} {...props} />
        </div>
    );
}
