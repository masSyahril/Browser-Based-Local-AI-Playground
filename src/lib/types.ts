import type { ChatRole, GenerationStats } from "./protocol";

export interface ChatMessage {
  id: string;
  role: Exclude<ChatRole, "system">;
  content: string;
  createdAt: number;
  /** Set on assistant messages once generation finishes. */
  stats?: GenerationStats;
  modelId?: string;
  aborted?: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  modelKey: string;
  systemPrompt: string;
  useSystemPrompt: boolean;
  temperature: number;
  topP: number;
  maxTokens: number;
}

export type EngineStatus = "idle" | "loading" | "ready" | "generating" | "error";

export interface LoadProgress {
  /** 0..100 */
  percent: number;
  text: string;
}

export interface LiveMetrics {
  tokensPerSec: number;
  tokenCount: number;
  lastStats: GenerationStats | null;
  loadTimeMs: number | null;
}

export interface WebGPUInfo {
  supported: boolean;
  supportsF16: boolean;
  adapterDescription: string;
  reason?: string;
}
