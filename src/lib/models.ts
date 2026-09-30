/**
 * Curated subset of WebLLM's prebuilt model list.
 *
 * Every model ships in two quantizations: `q4f16_1` (half-precision activations,
 * needs the WebGPU `shader-f16` feature) and `q4f32_1` (works on any WebGPU
 * adapter, uses more VRAM). We pick the variant at runtime based on adapter
 * capabilities — see `resolveModelId`.
 *
 * VRAM figures are copied from `prebuiltAppConfig` in @mlc-ai/web-llm 0.2.85.
 * Download sizes are approximate (4-bit weights ≈ 0.5 bytes/param + embeddings).
 * They are hard-coded so the main bundle never has to import web-llm itself —
 * the library is loaded only inside the worker.
 */

export interface ModelOption {
  /** Stable key used in settings / persisted state. */
  key: string;
  label: string;
  family: "Llama" | "Gemma" | "Phi" | "Qwen";
  params: string;
  description: string;
  approxDownloadGB: number;
  contextWindow: number;
  variants: {
    f16: { id: string; vramMB: number };
    f32: { id: string; vramMB: number };
  };
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    key: "llama-3.2-1b",
    label: "Llama 3.2 1B Instruct",
    family: "Llama",
    params: "1B",
    description: "Fastest to download. Good for quick tests and low-end GPUs.",
    approxDownloadGB: 0.7,
    contextWindow: 4096,
    variants: {
      f16: { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", vramMB: 879 },
      f32: { id: "Llama-3.2-1B-Instruct-q4f32_1-MLC", vramMB: 1129 },
    },
  },
  {
    key: "qwen-2.5-1.5b",
    label: "Qwen 2.5 1.5B Instruct",
    family: "Qwen",
    params: "1.5B",
    description: "Small but strong at code and structured output.",
    approxDownloadGB: 1.0,
    contextWindow: 4096,
    variants: {
      f16: { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", vramMB: 1630 },
      f32: { id: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC", vramMB: 1889 },
    },
  },
  {
    key: "gemma-2-2b",
    label: "Gemma 2 2B IT",
    family: "Gemma",
    params: "2B",
    description: "Google's compact instruction-tuned model. Fluent prose.",
    approxDownloadGB: 1.4,
    contextWindow: 4096,
    variants: {
      f16: { id: "gemma-2-2b-it-q4f16_1-MLC", vramMB: 1895 },
      f32: { id: "gemma-2-2b-it-q4f32_1-MLC", vramMB: 2509 },
    },
  },
  {
    key: "llama-3.2-3b",
    label: "Llama 3.2 3B Instruct",
    family: "Llama",
    params: "3B",
    description: "Best quality-per-GB in the list. Recommended default upgrade.",
    approxDownloadGB: 1.8,
    contextWindow: 4096,
    variants: {
      f16: { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", vramMB: 2264 },
      f32: { id: "Llama-3.2-3B-Instruct-q4f32_1-MLC", vramMB: 2952 },
    },
  },
  {
    key: "phi-3.5-mini",
    label: "Phi 3.5 Mini Instruct",
    family: "Phi",
    params: "3.8B",
    description: "Microsoft's reasoning-focused small model.",
    approxDownloadGB: 2.2,
    contextWindow: 4096,
    variants: {
      f16: { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", vramMB: 3672 },
      f32: { id: "Phi-3.5-mini-instruct-q4f32_1-MLC", vramMB: 5483 },
    },
  },
  {
    key: "llama-3.1-8b",
    label: "Llama 3.1 8B Instruct",
    family: "Llama",
    params: "8B",
    description: "Highest quality. Needs a discrete GPU with 6 GB+ VRAM.",
    approxDownloadGB: 4.6,
    contextWindow: 4096,
    variants: {
      f16: { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC", vramMB: 5001 },
      f32: { id: "Llama-3.1-8B-Instruct-q4f32_1-MLC", vramMB: 6101 },
    },
  },
];

export const DEFAULT_MODEL_KEY = MODEL_OPTIONS[0].key;

export function getModelOption(key: string): ModelOption {
  return MODEL_OPTIONS.find((m) => m.key === key) ?? MODEL_OPTIONS[0];
}

/** Picks the concrete WebLLM model id for the current adapter. */
export function resolveModelVariant(option: ModelOption, supportsF16: boolean) {
  return supportsF16 ? option.variants.f16 : option.variants.f32;
}

export function findOptionByModelId(modelId: string): ModelOption | undefined {
  return MODEL_OPTIONS.find(
    (m) => m.variants.f16.id === modelId || m.variants.f32.id === modelId,
  );
}
