"use client";

import { Check, Copy, Cpu, TriangleAlert } from "lucide-react";
import { memo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { findOptionByModelId } from "@/lib/models";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { CodeBlock } from "./CodeBlock";

const markdownComponents: Components = {
  // Fenced blocks are rendered by CodeBlock, which draws its own <pre>.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children ?? "").replace(/\n$/, "");
    const match = /language-(\S+)/.exec(className ?? "");
    if (match || text.includes("\n")) {
      return <CodeBlock language={match?.[1] ?? ""} code={text} />;
    }
    return <code>{children}</code>;
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

const remarkPlugins = [remarkGfm];

const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
});

interface ChatMessageProps {
  message: ChatMessageType;
  streaming: boolean;
}

export const ChatMessage = memo(function ChatMessage({ message, streaming }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const modelLabel = message.modelId
    ? (findOptionByModelId(message.modelId)?.label ?? message.modelId)
    : null;
  const waiting = streaming && !message.content;

  return (
    <div className="group flex gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-accent">
        <Cpu className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        {waiting ? (
          <div className="flex h-7 items-center gap-1" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-pulse rounded-full bg-muted"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        ) : (
          <div
            className={`md break-words text-[15px] leading-relaxed ${
              streaming ? "streaming-caret" : ""
            }`}
          >
            <Markdown content={message.content} />
          </div>
        )}

        {message.error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{message.error}</span>
          </div>
        )}

        {!streaming && (message.content || message.aborted) && (
          <MessageFooter message={message} modelLabel={modelLabel} />
        )}
      </div>
    </div>
  );
});

function MessageFooter({
  message,
  modelLabel,
}: {
  message: ChatMessageType;
  modelLabel: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const stats = message.stats;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-surface-2 hover:text-fg"
        aria-label="Copy message"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "copied" : "copy"}
      </button>
      {modelLabel && <span>{modelLabel}</span>}
      {stats && (
        <>
          <span>{stats.decodeTokensPerSec.toFixed(1)} tok/s</span>
          <span>{stats.completionTokens} tokens</span>
          <span>TTFT {Math.round(stats.timeToFirstTokenMs)} ms</span>
        </>
      )}
      {message.aborted && <span className="text-danger">stopped</span>}
    </div>
  );
}
