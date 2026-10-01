"use client";

import { Cpu, MessageSquare, Plus, Trash, X } from "lucide-react";
import type { Conversation } from "@/lib/types";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  disabled: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

export function ConversationList({
  conversations,
  activeId,
  disabled,
  onNew,
  onSelect,
  onDelete,
  onClose,
}: ConversationListProps) {
  return (
    <nav className="flex h-full w-full flex-col bg-surface" aria-label="Conversations">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-fg">
          <Cpu className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">Local AI Playground</div>
          <div className="text-[11px] text-muted">WebGPU · on-device</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Close conversations"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          New chat
        </button>
      </div>

      <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">
            Conversations are saved to IndexedDB in this browser only.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    disabled={disabled && !active}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg py-2 pr-8 pl-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{c.title || "Untitled"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    disabled={disabled && active}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:text-danger focus-visible:opacity-100 disabled:hidden"
                    aria-label={`Delete conversation "${c.title}"`}
                  >
                    <Trash className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
