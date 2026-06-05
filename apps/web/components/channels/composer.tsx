"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useRealtime } from "@/components/realtime/realtime-provider";
import { postMessage } from "@/lib/actions/messages";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";

export function Composer({ channelId, channelName }: { channelId: string; channelName: string }) {
    const router = useRouter();
    const { sendTyping } = useRealtime();
    const [body, setBody] = useState("");
    const [pending, setPending] = useState(false);

    async function send() {
        const trimmed = body.trim();
        if (!trimmed || pending) return;

        setPending(true);
        const formData = new FormData();
        formData.set("channelId", channelId);
        formData.set("body", trimmed);
        try {
            await postMessage(formData);
            setBody("");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send message");
        } finally {
            setPending(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
    }

    return (
        <div className="border-t bg-background p-3">
            <div className="flex items-end gap-2">
                <Textarea
                    value={body}
                    onChange={(e) => {
                        setBody(e.target.value);
                        if (e.target.value.trim().length > 0) sendTyping(channelId);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message #${channelName}`}
                    rows={1}
                    className="max-h-40 min-h-10 resize-none"
                />
                <Button onClick={() => void send()} disabled={pending || body.trim().length === 0}>
                    Send
                </Button>
            </div>
        </div>
    );
}
