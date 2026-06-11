"use client";

import { Placeholder } from "@tiptap/extensions";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import {
    EditorContent,
    ReactRenderer,
    useEditor,
    useEditorState,
    type Editor
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code, Italic, Link2, List, ListOrdered, Mic, Strikethrough } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { EmojiPicker } from "@/components/channels/emoji-picker";
import { MentionList, type MentionListHandle } from "@/components/channels/mention-list";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { extractMentionIds } from "@/lib/messaging/rich-text";
import { cn } from "@workspace/ui/lib/utils";

export type RichTextEditorHandle = { clear: () => void; focus: () => void };

export type EditorState = { html: string; isEmpty: boolean; mentionIds: string[] };

type Member = { id: string; name: string };

/** Build the Tiptap mention suggestion config, anchored above the caret. */
function mentionSuggestion(members: () => Member[]) {
    return {
        items: ({ query }: { query: string }) =>
            members()
                .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 6),
        render: () => {
            let component: ReactRenderer<MentionListHandle> | null = null;
            let popup: HTMLDivElement | null = null;

            const place = (rect: DOMRect | null | undefined) => {
                if (!popup || !rect) return;
                popup.style.left = `${rect.left + window.scrollX}px`;
                popup.style.top = `${rect.top + window.scrollY}px`;
            };

            return {
                onStart: (props: SuggestionProps) => {
                    component = new ReactRenderer(MentionList, { props, editor: props.editor });
                    popup = document.createElement("div");
                    popup.style.position = "absolute";
                    popup.style.zIndex = "50";
                    popup.style.transform = "translateY(calc(-100% - 6px))";
                    popup.appendChild(component.element);
                    document.body.appendChild(popup);
                    place(props.clientRect?.());
                },
                onUpdate: (props: SuggestionProps) => {
                    component?.updateProps(props);
                    place(props.clientRect?.());
                },
                onKeyDown: (props: { event: KeyboardEvent }) => {
                    if (props.event.key === "Escape") {
                        popup?.remove();
                        return true;
                    }
                    return component?.ref?.onKeyDown(props.event) ?? false;
                },
                onExit: () => {
                    popup?.remove();
                    popup = null;
                    component?.destroy();
                    component = null;
                }
            };
        }
    };
}

function ToolbarButton({
    onClick,
    active,
    label,
    children
}: {
    onClick: () => void;
    active?: boolean;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            data-component="ToolbarButton"
            type="button"
            aria-label={label}
            aria-pressed={active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={cn(
                "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
                active && "bg-muted text-foreground"
            )}
        >
            {children}
        </button>
    );
}

function Toolbar({ editor }: { editor: Editor }) {
    const state = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            strike: e.isActive("strike"),
            code: e.isActive("code"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            link: e.isActive("link")
        })
    });

    const speech = useSpeechRecognition({
        onResult: (text) => editor.chain().focus().insertContent(`${text} `).run()
    });

    function toggleLink() {
        if (state.link) {
            editor.chain().focus().unsetLink().run();
            return;
        }
        const url = window.prompt("Link URL");
        if (!url) return;
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        editor.chain().focus().setLink({ href }).run();
    }

    return (
        <div
            data-component="Toolbar"
            className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1"
        >
            <ToolbarButton
                label="Bold"
                active={state.bold}
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <Bold className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label="Italic"
                active={state.italic}
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <Italic className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label="Strikethrough"
                active={state.strike}
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <Strikethrough className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label="Inline code"
                active={state.code}
                onClick={() => editor.chain().focus().toggleCode().run()}
            >
                <Code className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label="Bullet list"
                active={state.bullet}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <List className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label="Numbered list"
                active={state.ordered}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="size-4" />
            </ToolbarButton>
            <ToolbarButton label="Link" active={state.link} onClick={toggleLink}>
                <Link2 className="size-4" />
            </ToolbarButton>

            <span className="mx-0.5 h-5 w-px bg-border" />

            <EmojiPicker onSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()} />

            {speech.supported && (
                <ToolbarButton
                    label={speech.listening ? "Stop dictation" : "Dictate"}
                    active={speech.listening}
                    onClick={speech.toggle}
                >
                    <Mic className={cn("size-4", speech.listening && "text-red-500")} />
                </ToolbarButton>
            )}
        </div>
    );
}

export const RichTextEditor = forwardRef<
    RichTextEditorHandle,
    {
        members: Member[];
        placeholder?: string;
        autoFocus?: boolean;
        initialHtml?: string;
        onChange: (state: EditorState) => void;
        onSubmit?: () => void;
        onTyping?: () => void;
        className?: string;
    }
>(
    (
        { members, placeholder, autoFocus, initialHtml, onChange, onSubmit, onTyping, className },
        ref
    ) => {
        // Keep callbacks/members fresh without re-creating the editor. These are
        // only read later (in event handlers / the mention plugin), never in render.
        const membersRef = useRef(members);
        const onSubmitRef = useRef(onSubmit);
        const onTypingRef = useRef(onTyping);
        useEffect(() => {
            membersRef.current = members;
            onSubmitRef.current = onSubmit;
            onTypingRef.current = onTyping;
        });

        const emit = (editor: Editor) =>
            onChange({
                html: editor.isEmpty ? "" : editor.getHTML(),
                isEmpty: editor.isEmpty,
                mentionIds: extractMentionIds(editor.getJSON())
            });

        const editor = useEditor({
            immediatelyRender: false,
            extensions: [
                StarterKit.configure({ link: { openOnClick: false } }),
                Placeholder.configure({ placeholder: placeholder ?? "Write a message…" }),
                Mention.configure({
                    HTMLAttributes: { class: "mention" },
                    // eslint-disable-next-line react-hooks/refs -- getter is invoked by the plugin after mount, not during render
                    suggestion: mentionSuggestion(() => membersRef.current)
                })
            ],
            content: initialHtml ?? "",
            autofocus: autoFocus ? "end" : false,
            editorProps: {
                attributes: {
                    // Mobile font-size floored at 16px (max(1rem,16px)) so iOS
                    // never auto-zooms on focus, even when the base font scale
                    // shrinks the UI (Small); shrink to text-sm at md+ (matching
                    // Input/Textarea) where zoom isn't triggered.
                    class: "tiptap-content max-h-48 min-h-10 overflow-y-auto px-3 py-2 text-[max(1rem,16px)] outline-none md:text-sm"
                },
                handleKeyDown: (_view, event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        onSubmitRef.current?.();
                        return true;
                    }
                    return false;
                }
            },
            onUpdate: ({ editor }) => {
                emit(editor);
                if (!editor.isEmpty) onTypingRef.current?.();
            }
        });

        useImperativeHandle(ref, () => ({
            clear: () => editor?.commands.clearContent(true),
            focus: () => editor?.commands.focus("end")
        }));

        return (
            <div
                data-component="RichTextEditor"
                className={cn(
                    "bg-background focus-within:ring-3 focus-within:ring-ring/30",
                    className
                )}
            >
                {editor && <Toolbar editor={editor} />}
                <EditorContent editor={editor} />
            </div>
        );
    }
);

RichTextEditor.displayName = "RichTextEditor";
