"use client";

import { CircleStop, SendHorizontal, SlidersHorizontal } from "lucide-react";
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  generating: boolean;
  /** False until a model is loaded. */
  canSend: boolean;
  placeholder: string;
  useSystemPrompt: boolean;
  onToggleSystemPrompt: () => void;
  onOpenSettings: () => void;
}

const MAX_HEIGHT_PX = 240;

export function ChatInput({
  onSend,
  onStop,
  generating,
  canSend,
  placeholder,
  useSystemPrompt,
  onToggleSystemPrompt,
  onOpenSettings,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: reset to `auto` so the textarea can also shrink, then fit content.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [value]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (generating || !canSend || !value.trim()) return;
    onSend(value);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline; don't hijack IME composition.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-surface shadow-sm transition focus-within:border-muted/70"
    >
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <textarea
        id="chat-input"
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="scroll-thin block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-relaxed placeholder:text-muted focus:outline-none"
      />
      <div className="flex items-center gap-2 px-2.5 pb-2.5">
        <button
          type="button"
          onClick={onToggleSystemPrompt}
          aria-pressed={useSystemPrompt}
          className={`rounded-full border px-2.5 py-1 text-xs transition ${
            useSystemPrompt
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-border text-muted hover:text-fg"
          }`}
          title="Toggle whether the system prompt is sent with each request"
        >
          System prompt {useSystemPrompt ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-full p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg"
          aria-label="Open generation settings"
          title="Generation settings"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
        </button>
        <span className="ml-auto hidden text-[11px] text-muted sm:inline">
          Enter to send · Shift+Enter for newline
        </span>
        <div className="ml-auto sm:ml-0">
          {generating ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1.5 rounded-xl bg-fg px-3 py-2 text-sm font-medium text-bg transition hover:opacity-90"
            >
              <CircleStop className="size-4" aria-hidden />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend || !value.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendHorizontal className="size-4" aria-hidden />
              Send
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
