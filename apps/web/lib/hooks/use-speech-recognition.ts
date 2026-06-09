"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper over the browser-native Web Speech API (SpeechRecognition).
 * No backend, no keys — supported on Chrome, Edge, Android, and iOS Safari 16.4+.
 * Finalized transcript segments are delivered via `onResult`.
 */

// The Web Speech API isn't in the standard DOM lib types; declare what we use.
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean };
type SpeechRecognitionEventLike = {
    resultIndex: number;
    results: { length: number; [index: number]: SpeechRecognitionResult };
};
type SpeechRecognitionInstance = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition({
    onResult,
    lang
}: {
    /** Called with each finalized transcript segment. */
    onResult: (text: string) => void;
    lang?: string;
}) {
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const onResultRef = useRef(onResult);
    useEffect(() => {
        onResultRef.current = onResult;
    });

    const supported = typeof window !== "undefined" && getRecognitionCtor() !== null;

    const stop = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const start = useCallback(() => {
        const Ctor = getRecognitionCtor();
        if (!Ctor || recognitionRef.current) return;

        const recognition = new Ctor();
        recognition.lang =
            lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result?.isFinal) {
                    const text = result[0].transcript.trim();
                    if (text) onResultRef.current(text);
                }
            }
        };
        recognition.onerror = () => setListening(false);
        recognition.onend = () => {
            recognitionRef.current = null;
            setListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
    }, [lang]);

    const toggle = useCallback(() => {
        if (recognitionRef.current) stop();
        else start();
    }, [start, stop]);

    useEffect(() => () => recognitionRef.current?.abort(), []);

    return { supported, listening, start, stop, toggle };
}
