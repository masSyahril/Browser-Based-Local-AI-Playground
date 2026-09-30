"use client";

import { ShieldCheck, WifiOff, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { ErrorBoundary } from "../ErrorBoundary";
import { ChatMessage } from "./ChatMessage";

const SUGGESTIONS = [
  "Explain how WebGPU differs from WebGL in three bullet points.",
  "Write a TypeScript debounce function with generics and tests.",
  "Summarize the trade-offs of running LLMs on-device vs in the cloud.",
  "Give me a regex that validates ISO 8601 dates, and explain it.",
];

interface ChatWindowProps {
  conversationId: string | null;
  messages: ChatMessageType[];
  generating: boolean;
  modelReady: boolean;
  onSuggestion: (text: string) => void;
}

export function ChatWindow({
  conversationId,
  messages,
  generating,
  modelReady,
  onSuggestion,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Follow the stream, but stop following if the user scrolls up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const lastId = messages.at(-1)?.id;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <EmptyState modelReady={modelReady} onSuggestion={onSuggestion} />
        ) : (
          <ErrorBoundary key={conversationId ?? "new"} label="the message list">
            <div className="space-y-7">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} streaming={generating && m.id === lastId} />
              ))}
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  modelReady,
  onSuggestion,
}: {
  modelReady: boolean;
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="pt-[8vh]">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        A language model, running on your GPU.
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Weights are downloaded once, cached by your browser, and executed with WebGPU inside a
        Web Worker. Your prompts never leave this tab.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
        <Pill icon={<ShieldCheck className="size-3.5" />}>No server, no API key</Pill>
        <Pill icon={<WifiOff className="size-3.5" />}>Works offline after first load</Pill>
        <Pill icon={<Zap className="size-3.5" />}>WebGPU accelerated</Pill>
      </div>

      <div className="mt-10">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          {modelReady ? "Try a prompt" : "Load a model from the panel, then try"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!modelReady}
              onClick={() => onSuggestion(s)}
              className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm leading-snug transition hover:border-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}
