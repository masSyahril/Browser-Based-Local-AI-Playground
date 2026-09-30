"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MODEL_OPTIONS,
  findOptionByModelId,
  getModelOption,
  resolveModelVariant,
} from "@/lib/models";
import type { WireMessage, WorkerRequest, WorkerResponse } from "@/lib/protocol";
import * as storage from "@/lib/storage";
import type {
  ChatMessage,
  Conversation,
  EngineStatus,
  LiveMetrics,
  LoadProgress,
  Settings,
} from "@/lib/types";

interface ActiveRequest {
  requestId: string;
  conversationId: string;
  messageId: string;
}

const EMPTY_METRICS: LiveMetrics = {
  tokensPerSec: 0,
  tokenCount: 0,
  lastStats: null,
  loadTimeMs: null,
};

/** Rough chars-per-token ratio for English; good enough for a context budget. */
const CHARS_PER_TOKEN = 3.5;

function patchMessage(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  patch: (m: ChatMessage) => ChatMessage,
): Conversation[] {
  return conversations.map((c) =>
    c.id !== conversationId
      ? c
      : {
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) => (m.id === messageId ? patch(m) : m)),
        },
  );
}

/**
 * Drops the oldest turns until the prompt fits in the model's context window,
 * leaving room for `maxTokens` of output. Without this, long chats fail with a
 * hard context-overflow error from WebLLM.
 */
function fitToContext(
  system: WireMessage | null,
  history: WireMessage[],
  contextWindow: number,
  maxTokens: number,
): WireMessage[] {
  const budget = (contextWindow - maxTokens) * CHARS_PER_TOKEN;
  let used = system ? system.content.length : 0;
  const kept: WireMessage[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    used += history[i].content.length;
    if (used > budget && kept.length > 0) break;
    kept.unshift(history[i]);
  }
  // Most chat templates expect the first non-system turn to be the user's.
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return system ? [system, ...kept] : kept;
}

export function useLocalAI(settings: Settings, supportsF16: boolean) {
  const workerRef = useRef<Worker | null>(null);

  const [status, setStatus] = useState<EngineStatus>("idle");
  const [progress, setProgress] = useState<LoadProgress>({ percent: 0, text: "" });
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<LiveMetrics>(EMPTY_METRICS);
  const [cached, setCached] = useState<Record<string, boolean>>({});

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Streaming state lives in refs: tokens arrive faster than we want to render,
  // so we accumulate here and flush at most once per animation frame.
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const bufferRef = useRef("");
  const liveMetricsRef = useRef({ tokensPerSec: 0, tokenCount: 0 });
  const rafRef = useRef<number | null>(null);
  const dirtyRef = useRef(new Set<string>());

  const post = useCallback((msg: WorkerRequest) => {
    workerRef.current?.postMessage(msg);
  }, []);

  // ---------- Worker lifecycle ----------
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/llm.worker.ts", import.meta.url),
      { type: "module", name: "llm-worker" },
    );
    workerRef.current = worker;

    const flush = () => {
      rafRef.current = null;
      const req = activeRequestRef.current;
      if (!req) return;
      const content = bufferRef.current;
      setConversations((prev) =>
        patchMessage(prev, req.conversationId, req.messageId, (m) => ({
          ...m,
          content,
        })),
      );
      const live = liveMetricsRef.current;
      setMetrics((prev) => ({ ...prev, ...live }));
    };

    const handle = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      switch (msg.type) {
        case "progress":
          setStatus("loading");
          setProgress({ percent: Math.round(msg.progress * 100), text: msg.text });
          break;

        case "ready":
          setStatus("ready");
          setLoadedModelId(msg.modelId);
          setLoadingModelId(null);
          setProgress({ percent: 100, text: "Model ready" });
          setCached((prev) => ({ ...prev, [msg.modelId]: true }));
          setMetrics((prev) => ({ ...prev, loadTimeMs: msg.loadTimeMs }));
          break;

        case "token": {
          const req = activeRequestRef.current;
          if (!req || req.requestId !== msg.requestId) return;
          bufferRef.current += msg.delta;
          liveMetricsRef.current = {
            tokensPerSec: msg.tokensPerSec,
            tokenCount: msg.tokenCount,
          };
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(flush);
          }
          break;
        }

        case "complete": {
          const req = activeRequestRef.current;
          if (!req || req.requestId !== msg.requestId) return;
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          activeRequestRef.current = null;
          dirtyRef.current.add(req.conversationId);
          setConversations((prev) =>
            patchMessage(prev, req.conversationId, req.messageId, (m) => ({
              ...m,
              content: msg.content,
              stats: msg.stats,
              aborted: msg.aborted,
            })),
          );
          setMetrics((prev) => ({
            ...prev,
            tokensPerSec: msg.stats.decodeTokensPerSec,
            tokenCount: msg.stats.completionTokens,
            lastStats: msg.stats,
          }));
          setStatus("ready");
          break;
        }

        case "error":
          if (msg.scope === "init") {
            setStatus("error");
            setLoadingModelId(null);
            setLoadedModelId(null);
            setError(msg.message);
          } else if (msg.scope === "generate") {
            const req = activeRequestRef.current;
            if (req && req.requestId === msg.requestId) {
              if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
              activeRequestRef.current = null;
              dirtyRef.current.add(req.conversationId);
              const partial = bufferRef.current;
              setConversations((prev) =>
                patchMessage(prev, req.conversationId, req.messageId, (m) => ({
                  ...m,
                  content: partial,
                  error: msg.message,
                })),
              );
            }
            setStatus((s) => (s === "generating" ? "ready" : s));
          } else {
            setError(msg.message);
          }
          break;

        case "cache-status":
          setCached((prev) => ({ ...prev, ...msg.cached }));
          break;
      }
    };

    const handleCrash = (event: ErrorEvent) => {
      setStatus("error");
      setError(
        `The inference worker crashed: ${event.message || "unknown error"}. Reload the page to try again.`,
      );
    };

    worker.addEventListener("message", handle);
    worker.addEventListener("error", handleCrash);

    const ids = MODEL_OPTIONS.map((m) => resolveModelVariant(m, supportsF16).id);
    worker.postMessage({ type: "CHECK_CACHE", modelIds: ids } satisfies WorkerRequest);

    return () => {
      worker.removeEventListener("message", handle);
      worker.removeEventListener("error", handleCrash);
      worker.terminate();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      workerRef.current = null;
    };
  }, [supportsF16]);

  // ---------- History persistence ----------
  useEffect(() => {
    let cancelled = false;
    storage.loadConversations().then((loaded) => {
      if (cancelled) return;
      setConversations(loaded);
      setActiveId(loaded[0]?.id ?? null);
      setHistoryLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    const streamingId = activeRequestRef.current?.conversationId;
    for (const id of dirtyRef.current) {
      // Don't write to IndexedDB on every token; the streaming conversation is
      // persisted once on `complete`/`error`.
      if (id === streamingId) continue;
      const conversation = conversations.find((c) => c.id === id);
      if (conversation) void storage.saveConversation(conversation);
      dirtyRef.current.delete(id);
    }
  }, [conversations, historyLoaded]);

  // ---------- Public actions ----------
  const loadModel = useCallback(
    (modelKey: string) => {
      const option = getModelOption(modelKey);
      const { id } = resolveModelVariant(option, supportsF16);
      setError(null);
      setStatus("loading");
      setLoadingModelId(id);
      setProgress({ percent: 0, text: "Starting…" });
      post({ type: "INIT_MODEL", modelId: id });
    },
    [post, supportsF16],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt || status !== "ready" || !loadedModelId) return;

      const now = Date.now();
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        createdAt: now,
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: now,
        modelId: loadedModelId,
      };

      const existing = conversations.find((c) => c.id === activeId);
      const conversation: Conversation = existing ?? {
        id: crypto.randomUUID(),
        title: prompt.slice(0, 60),
        messages: [],
        createdAt: now,
        updatedAt: now,
      };

      const history: WireMessage[] = [...conversation.messages, userMsg]
        .filter((m) => m.content && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));
      const system =
        settings.useSystemPrompt && settings.systemPrompt.trim()
          ? ({ role: "system", content: settings.systemPrompt.trim() } as const)
          : null;
      const option = findOptionByModelId(loadedModelId);
      const messages = fitToContext(
        system,
        history,
        option?.contextWindow ?? 4096,
        settings.maxTokens,
      );

      const updated: Conversation = {
        ...conversation,
        messages: [...conversation.messages, userMsg, assistantMsg],
        updatedAt: now,
      };
      setConversations((prev) => [updated, ...prev.filter((c) => c.id !== updated.id)]);
      setActiveId(updated.id);

      const requestId = crypto.randomUUID();
      activeRequestRef.current = {
        requestId,
        conversationId: updated.id,
        messageId: assistantMsg.id,
      };
      bufferRef.current = "";
      liveMetricsRef.current = { tokensPerSec: 0, tokenCount: 0 };
      dirtyRef.current.add(updated.id);
      setMetrics((prev) => ({ ...prev, tokensPerSec: 0, tokenCount: 0 }));
      setStatus("generating");

      post({
        type: "GENERATE_TEXT",
        requestId,
        messages,
        params: {
          temperature: settings.temperature,
          topP: settings.topP,
          maxTokens: settings.maxTokens,
        },
      });
    },
    [activeId, conversations, loadedModelId, post, settings, status],
  );

  const stop = useCallback(() => post({ type: "ABORT_GENERATION" }), [post]);

  const deleteModelCache = useCallback(
    (modelKey: string) => {
      const { id } = resolveModelVariant(getModelOption(modelKey), supportsF16);
      if (id === loadedModelId) {
        setLoadedModelId(null);
        setStatus("idle");
        setProgress({ percent: 0, text: "" });
      }
      post({ type: "DELETE_CACHE", modelId: id });
    },
    [loadedModelId, post, supportsF16],
  );

  const newConversation = useCallback(() => {
    // Created lazily on first send so we never persist empty chats.
    if (status !== "generating") setActiveId(null);
  }, [status]);

  const selectConversation = useCallback(
    (id: string) => {
      if (status !== "generating") setActiveId(id);
    },
    [status],
  );

  const removeConversation = useCallback(
    (id: string) => {
      if (activeRequestRef.current?.conversationId === id) return;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
      void storage.deleteConversation(id);
    },
    [activeId],
  );

  const dismissError = useCallback(() => {
    setError(null);
    setStatus((s) => (s === "error" ? "idle" : s));
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return {
    status,
    progress,
    error,
    metrics,
    cached,
    loadedModelId,
    loadingModelId,
    conversations,
    activeConversation,
    historyLoaded,
    loadModel,
    sendMessage,
    stop,
    deleteModelCache,
    newConversation,
    selectConversation,
    removeConversation,
    dismissError,
  };
}

export type LocalAI = ReturnType<typeof useLocalAI>;
