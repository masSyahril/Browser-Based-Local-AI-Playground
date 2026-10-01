"use client";

import { Menu, PanelRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalAI } from "@/hooks/useLocalAI";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { findOptionByModelId } from "@/lib/models";
import { loadSettings, saveSettings } from "@/lib/storage";
import type { Settings, WebGPUInfo } from "@/lib/types";
import { ChatInput } from "./Chat/ChatInput";
import { ChatWindow } from "./Chat/ChatWindow";
import { ConversationList } from "./ConversationList";
import { ErrorBoundary } from "./ErrorBoundary";
import { LiveAnnouncer } from "./LiveAnnouncer";
import { Sidebar } from "./Sidebar";

type Drawer = "none" | "history" | "controls";

export function Playground({ gpu }: { gpu: WebGPUInfo }) {
  // Safe to read localStorage in the initializer: this component only mounts
  // on the client, after WebGPUCheck's async probe resolves.
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [drawer, setDrawer] = useState<Drawer>("none");
  const ai = useLocalAI(settings, gpu.supportsF16);

  useEffect(() => saveSettings(settings), [settings]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );

  const generating = ai.status === "generating";
  const modelReady = ai.status === "ready" || generating;
  const loadedLabel = ai.loadedModelId
    ? (findOptionByModelId(ai.loadedModelId)?.label ?? ai.loadedModelId)
    : null;

  // Below these breakpoints the panels are off-canvas drawers. A drawer that is
  // translated off-screen is still focusable and read by screen readers, so
  // closed drawers are made `inert`.
  const historyDocked = useMediaQuery("(min-width: 1024px)");
  const controlsDocked = useMediaQuery("(min-width: 1280px)");
  const historyHidden = !historyDocked && drawer !== "history";
  const controlsHidden = !controlsDocked && drawer !== "controls";

  const historyRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const openDrawer = (which: Exclude<Drawer, "none">) => {
    openerRef.current = document.activeElement as HTMLElement | null;
    setDrawer(which);
  };

  const closeDrawer = useCallback(() => {
    setDrawer("none");
    openerRef.current?.focus();
    openerRef.current = null;
  }, []);

  // Move focus into an opened drawer; Escape closes it.
  useEffect(() => {
    if (drawer === "none") return;
    const panel = drawer === "history" ? historyRef.current : controlsRef.current;
    panel?.querySelector<HTMLElement>("button, [href], input, textarea, select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, closeDrawer]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Left: conversation history */}
      <div
        ref={historyRef}
        inert={historyHidden}
        role={historyDocked ? undefined : "dialog"}
        aria-modal={historyDocked ? undefined : drawer === "history"}
        aria-label={historyDocked ? undefined : "Conversations"}
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-border transition-transform lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
          drawer === "history" ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ErrorBoundary label="the conversation list">
          <ConversationList
            conversations={ai.conversations}
            activeId={ai.activeConversation?.id ?? null}
            disabled={generating}
            onNew={() => {
              ai.newConversation();
              closeDrawer();
            }}
            onSelect={(id) => {
              ai.selectConversation(id);
              closeDrawer();
            }}
            onDelete={ai.removeConversation}
            onClose={drawer === "history" ? closeDrawer : undefined}
          />
        </ErrorBoundary>
      </div>

      {/* Center: chat */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 lg:px-5">
          <button
            type="button"
            onClick={() => openDrawer("history")}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
            aria-label="Open conversations"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <h1 className="sr-only">Local AI Playground</h1>
          <StatusDot status={ai.status} />
          <span className="truncate text-sm">
            {ai.status === "loading"
              ? `Loading model… ${ai.progress.percent}%`
              : loadedLabel
                ? loadedLabel
                : "No model loaded"}
          </span>
          {generating && (
            <span className="ml-1 hidden font-mono text-xs text-muted sm:inline">
              {ai.metrics.tokensPerSec.toFixed(1)} tok/s
            </span>
          )}
          <button
            type="button"
            onClick={() => openDrawer("controls")}
            className="ml-auto rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg xl:hidden"
            aria-label="Open control panel"
          >
            <PanelRight className="size-5" aria-hidden />
          </button>
        </header>

        <ChatWindow
          conversationId={ai.activeConversation?.id ?? null}
          messages={ai.activeConversation?.messages ?? []}
          generating={generating}
          modelReady={ai.status === "ready"}
          onSuggestion={ai.sendMessage}
        />

        <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
          <ChatInput
            onSend={ai.sendMessage}
            onStop={ai.stop}
            generating={generating}
            canSend={ai.status === "ready"}
            placeholder={
              modelReady ? "Message the local model…" : "Load a model to start chatting"
            }
            useSystemPrompt={settings.useSystemPrompt}
            onToggleSystemPrompt={() =>
              updateSettings({ useSystemPrompt: !settings.useSystemPrompt })
            }
            onOpenSettings={() => {
              if (!controlsDocked) openDrawer("controls");
              else controlsRef.current?.querySelector<HTMLElement>("#slider-temperature")?.focus();
            }}
          />
          <p className="mt-2 text-center text-[11px] text-muted">
            Runs entirely in your browser. Small models make mistakes — verify important output.
          </p>
        </div>
      </main>

      {/* Right: control panel */}
      <div
        ref={controlsRef}
        inert={controlsHidden}
        role={controlsDocked ? undefined : "dialog"}
        aria-modal={controlsDocked ? undefined : drawer === "controls"}
        aria-label={controlsDocked ? undefined : "Control panel"}
        className={`fixed inset-y-0 right-0 z-40 w-80 border-l border-border transition-transform xl:static xl:z-auto xl:translate-x-0 ${
          drawer === "controls" ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <ErrorBoundary label="the control panel">
          <Sidebar
            ai={ai}
            settings={settings}
            onSettingsChange={updateSettings}
            gpu={gpu}
            onClose={drawer === "controls" ? closeDrawer : undefined}
          />
        </ErrorBoundary>
      </div>

      <LiveAnnouncer status={ai.status} modelLabel={loadedLabel} error={ai.error} />

      {drawer !== "none" && (
        <div
          className="fixed inset-0 z-30 bg-black/40 xl:hidden"
          onClick={closeDrawer}
          aria-hidden
        />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "ready" || status === "generating"
      ? "bg-accent"
      : status === "loading"
        ? "bg-amber-400 animate-pulse"
        : status === "error"
          ? "bg-danger"
          : "bg-muted";
  return <span className={`size-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}
