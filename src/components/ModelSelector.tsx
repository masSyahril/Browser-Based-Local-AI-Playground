"use client";

import { Check, ChevronDown, HardDrive } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MODEL_OPTIONS, getModelOption, resolveModelVariant } from "@/lib/models";

interface ModelSelectorProps {
  value: string;
  onChange: (key: string) => void;
  supportsF16: boolean;
  cached: Record<string, boolean>;
  loadedModelId: string | null;
  disabled?: boolean;
}

function formatGB(mb: number) {
  return `${(mb / 1024).toFixed(1)} GB`;
}

/**
 * Custom listbox (a native <select> can't render the size/cache tags).
 * Keyboard: ↑/↓ to move, Enter/Space to pick, Esc to close.
 */
export function ModelSelector({
  value,
  onChange,
  supportsF16,
  cached,
  loadedModelId,
  disabled,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = getModelOption(value);
  const selectedIndex = MODEL_OPTIONS.findIndex((m) => m.key === selected.key);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    listRef.current?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const openList = () => {
    setHighlight(selectedIndex);
    setOpen(true);
  };

  // Return focus to the trigger so keyboard users aren't dropped onto <body>.
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const pick = (key: string) => {
    onChange(key);
    close();
  };

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, MODEL_OPTIONS.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(MODEL_OPTIONS[highlight].key);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const selectedVariant = resolveModelVariant(selected, supportsF16);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openList())}
        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-left transition hover:border-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{selected.label}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span>~{selected.approxDownloadGB} GB download</span>
            {cached[selectedVariant.id] && <CachedTag />}
          </div>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={0}
          aria-label="Model"
          aria-activedescendant={`${listId}-${highlight}`}
          onKeyDown={onListKey}
          className="scroll-thin absolute z-30 mt-1.5 max-h-[60vh] w-full overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-xl outline-none"
        >
          {MODEL_OPTIONS.map((m, i) => {
            const variant = resolveModelVariant(m, supportsF16);
            const isSelected = m.key === selected.key;
            return (
              <li
                key={m.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setHighlight(i)}
                onClick={() => pick(m.key)}
                className={`cursor-pointer rounded-md px-2.5 py-2 ${
                  i === highlight ? "bg-surface-2" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{m.label}</span>
                  {variant.id === loadedModelId && (
                    <span className="rounded bg-accent px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent-fg">
                      Loaded
                    </span>
                  )}
                  {isSelected && <Check className="ml-auto size-4 text-accent" aria-hidden />}
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted">{m.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Tag>{m.params} params</Tag>
                  <Tag>~{m.approxDownloadGB} GB download</Tag>
                  <Tag>{formatGB(variant.vramMB)} VRAM</Tag>
                  {cached[variant.id] && <CachedTag />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border px-1.5 py-px font-mono text-[10.5px] text-muted">
      {children}
    </span>
  );
}

function CachedTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-px text-[10.5px] font-medium text-accent">
      <HardDrive className="size-3" aria-hidden />
      Cached
    </span>
  );
}
