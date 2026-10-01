/**
 * Typed message contract between the UI thread and `llm.worker.ts`.
 * Both sides import from here so a protocol change is a compile error, not a
 * silent runtime mismatch.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface WireMessage {
  role: ChatRole;
  content: string;
}

export interface GenerationParams {
  temperature: number;
  topP: number;
  maxTokens: number;
}

export interface GenerationStats {
  completionTokens: number;
  promptTokens: number;
  /** Decode throughput reported by WebLLM (falls back to wall-clock estimate). */
  decodeTokensPerSec: number;
  prefillTokensPerSec: number;
  timeToFirstTokenMs: number;
  totalTimeMs: number;
}

// ---------- UI -> Worker ----------

export type WorkerRequest =
  | { type: "INIT_MODEL"; modelId: string }
  | {
      type: "GENERATE_TEXT";
      requestId: string;
      messages: WireMessage[];
      params: GenerationParams;
    }
  | { type: "ABORT_GENERATION" }
  | { type: "CHECK_CACHE"; modelIds: string[] }
  | { type: "DELETE_CACHE"; modelId: string };

// ---------- Worker -> UI ----------

export type WorkerResponse =
  | {
      type: "progress";
      modelId: string;
      /** 0..1 */
      progress: number;
      text: string;
      timeElapsedSec: number;
    }
  | { type: "ready"; modelId: string; loadTimeMs: number }
  | {
      type: "token";
      requestId: string;
      delta: string;
      tokenCount: number;
      /** Live wall-clock decode rate, updated per token. */
      tokensPerSec: number;
    }
  | {
      type: "complete";
      requestId: string;
      content: string;
      aborted: boolean;
      stats: GenerationStats;
    }
  | {
      type: "error";
      scope: "init" | "generate" | "cache";
      requestId?: string;
      message: string;
    }
  | { type: "cache-status"; cached: Record<string, boolean> };
