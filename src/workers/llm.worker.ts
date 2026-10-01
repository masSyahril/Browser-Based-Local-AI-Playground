/**
 * Dedicated worker that owns the WebLLM engine.
 *
 * Everything expensive — fetching/caching weights, compiling WebGPU pipelines,
 * prefill and decode — happens here, so the UI thread only receives small
 * `token` messages and stays responsive.
 */
import {
  MLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  type ChatCompletionMessageParam,
  type InitProgressReport,
} from "@mlc-ai/web-llm";
import type {
  GenerationStats,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/protocol";

// The project compiles against the DOM lib; `self.postMessage(msg)` resolves to
// the Window overload, which has the same runtime behaviour in a worker.
function post(message: WorkerResponse) {
  self.postMessage(message);
}

let currentModelId: string | null = null;
let loadingModelId: string | null = null;
let generating: Promise<void> | null = null;

const engine = new MLCEngine({
  logLevel: "WARN",
  initProgressCallback: (report: InitProgressReport) => {
    if (!loadingModelId) return;
    post({
      type: "progress",
      modelId: loadingModelId,
      progress: report.progress,
      text: report.text,
      timeElapsedSec: report.timeElapsed,
    });
  },
});

function errorMessage(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";

  // Translate the common low-level failures into something actionable.
  if (/failed to fetch|networkerror|load failed|err_/i.test(raw)) {
    return "Couldn't download the model files (huggingface.co / raw.githubusercontent.com). The first load needs an internet connection; after that the model is served from the browser cache.";
  }
  if (/quota|QuotaExceeded/i.test(raw)) {
    return "Not enough browser storage to cache this model. Free up disk space, delete another cached model, or pick a smaller one.";
  }
  if (/out of memory|device.*lost|OOM|allocation/i.test(raw)) {
    return `The GPU ran out of memory or was lost (${raw}). Try a smaller model or close other GPU-heavy tabs.`;
  }
  if (/context window|exceed.*context|prompt tokens exceed/i.test(raw)) {
    return "This conversation no longer fits in the model's context window. Start a new chat or lower Max tokens.";
  }
  return raw;
}

async function initModel(modelId: string) {
  // A reload while tokens are streaming would tear the KV cache out from under
  // the running request; stop it first.
  if (generating) {
    await engine.interruptGenerate();
    await generating.catch(() => undefined);
  }

  loadingModelId = modelId;
  const started = performance.now();
  try {
    await engine.reload(modelId);
    // A newer INIT_MODEL may have superseded this one while we awaited.
    if (loadingModelId !== modelId) return;
    currentModelId = modelId;
    loadingModelId = null;
    post({ type: "ready", modelId, loadTimeMs: performance.now() - started });
  } catch (err) {
    if (loadingModelId !== modelId) return; // aborted by a newer reload
    loadingModelId = null;
    currentModelId = null;
    post({ type: "error", scope: "init", message: errorMessage(err) });
  }
}

async function generate(
  req: Extract<WorkerRequest, { type: "GENERATE_TEXT" }>,
) {
  const { requestId, messages, params } = req;
  if (!currentModelId) {
    post({
      type: "error",
      scope: "generate",
      requestId,
      message: "No model is loaded yet.",
    });
    return;
  }

  const started = performance.now();
  let firstTokenAt = 0;
  let tokenCount = 0;
  let content = "";
  let aborted = false;
  let usage:
    | {
        completion_tokens: number;
        prompt_tokens: number;
        extra?: {
          decode_tokens_per_s?: number;
          prefill_tokens_per_s?: number;
          time_to_first_token_s?: number;
        };
      }
    | undefined;

  try {
    const stream = await engine.chat.completions.create({
      messages: messages as ChatCompletionMessageParam[],
      temperature: params.temperature,
      top_p: params.topP,
      max_tokens: params.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta?.content ?? "";
      if (delta) {
        if (tokenCount === 0) firstTokenAt = performance.now();
        tokenCount += 1;
        content += delta;
        const decodeSec = (performance.now() - firstTokenAt) / 1000;
        post({
          type: "token",
          requestId,
          delta,
          tokenCount,
          tokensPerSec: decodeSec > 0 ? (tokenCount - 1) / decodeSec : 0,
        });
      }
      if (choice?.finish_reason === "abort") aborted = true;
      if (chunk.usage) usage = chunk.usage;
    }

    const now = performance.now();
    const wallDecodeSec = firstTokenAt ? (now - firstTokenAt) / 1000 : 0;
    const stats: GenerationStats = {
      completionTokens: usage?.completion_tokens ?? tokenCount,
      promptTokens: usage?.prompt_tokens ?? 0,
      decodeTokensPerSec:
        usage?.extra?.decode_tokens_per_s ??
        (wallDecodeSec > 0 ? tokenCount / wallDecodeSec : 0),
      prefillTokensPerSec: usage?.extra?.prefill_tokens_per_s ?? 0,
      timeToFirstTokenMs:
        (usage?.extra?.time_to_first_token_s ?? 0) * 1000 ||
        (firstTokenAt ? firstTokenAt - started : 0),
      totalTimeMs: now - started,
    };
    post({ type: "complete", requestId, content, aborted, stats });
  } catch (err) {
    post({
      type: "error",
      scope: "generate",
      requestId,
      message: errorMessage(err),
    });
  }
}

async function checkCache(modelIds: string[]) {
  try {
    const entries = await Promise.all(
      modelIds.map(async (id) => [id, await hasModelInCache(id)] as const),
    );
    post({ type: "cache-status", cached: Object.fromEntries(entries) });
  } catch (err) {
    post({ type: "error", scope: "cache", message: errorMessage(err) });
  }
}

async function deleteCache(modelId: string) {
  try {
    if (modelId === currentModelId) {
      await engine.unload();
      currentModelId = null;
    }
    await deleteModelAllInfoInCache(modelId);
    post({ type: "cache-status", cached: { [modelId]: false } });
  } catch (err) {
    post({ type: "error", scope: "cache", message: errorMessage(err) });
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  switch (msg.type) {
    case "INIT_MODEL":
      void initModel(msg.modelId);
      break;
    case "GENERATE_TEXT": {
      const run = generate(msg);
      generating = run;
      void run.finally(() => {
        if (generating === run) generating = null;
      });
      break;
    }
    case "ABORT_GENERATION":
      void engine.interruptGenerate();
      break;
    case "CHECK_CACHE":
      void checkCache(msg.modelIds);
      break;
    case "DELETE_CACHE":
      void deleteCache(msg.modelId);
      break;
    default: {
      const exhaustive: never = msg;
      console.warn("Unknown worker message", exhaustive);
    }
  }
});
