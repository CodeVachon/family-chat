"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@workspace/ui/components/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";

/**
 * Generic pan + zoom crop editor over a fixed aspect box. Reports the crop
 * rectangle in natural-image pixels — non-destructive, so it can be reopened to
 * re-adjust. Used for both the square/round avatar and the wide profile banner.
 */
export function ImageCropEditor({
    open,
    imageSrc,
    initialCrop,
    aspect,
    cropShape = "rect",
    title,
    description,
    onCancel,
    onComplete
}: {
    open: boolean;
    imageSrc: string | null;
    initialCrop?: Area | null;
    aspect: number;
    cropShape?: "rect" | "round";
    title: string;
    description: string;
    onCancel: () => void;
    onComplete: (croppedAreaPixels: Area) => void;
}) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [pixels, setPixels] = useState<Area | null>(initialCrop ?? null);

    return (
        <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted">
                    {imageSrc && (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            cropShape={cropShape}
                            showGrid={false}
                            initialCroppedAreaPixels={initialCrop ?? undefined}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(_area, areaPixels) => setPixels(areaPixels)}
                        />
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="crop-zoom">Zoom</Label>
                    <input
                        id="crop-zoom"
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full"
                        aria-label="Zoom"
                    />
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button onClick={() => pixels && onComplete(pixels)} disabled={!pixels}>
                        Save crop
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
