# Local AI Playground

A privacy-first ChatGPT-style app that runs LLMs (Llama 3.x, Gemma 2, Phi 3.5, Qwen 2.5) **entirely in the browser** with WebGPU via [`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm). No backend, no API keys, no data leaving the tab.

**Stack:** Next.js 16 (App Router, React 19) · TypeScript (strict) · Tailwind CSS 4 · WebLLM · Web Workers · IndexedDB · lucide-react · react-markdown + Prism

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Requires a WebGPU browser (Chrome/Edge 113+, Safari 26+, Firefox 141+ on Windows) and a GPU with roughly 1–6 GB of free memory depending on the model. WebGPU only works on `https://` or `localhost`.

## Architecture

```
┌──────────────────────── UI thread ────────────────────────┐        ┌──────── llm.worker.ts ────────┐
│ WebGPUCheck ─ probes navigator.gpu, shader-f16            │        │ MLCEngine (web-llm)           │
│   └ Playground                                            │ INIT_  │  • fetch + cache weights      │
│       ├ ConversationList   (IndexedDB history)            │ MODEL  │  • compile WebGPU pipelines   │
│       ├ ChatWindow → ChatMessage → CodeBlock              │ ─────▶ │  • prefill / decode           │
│       ├ ChatInput                                         │ GENER- │                               │
│       └ Sidebar → ModelSelector, sliders, metrics         │ ATE_   │ progress / ready / token /    │
│                                                           │ TEXT   │ complete / error / cache-     │
│ useLocalAI() — owns the Worker, batches tokens per rAF    │ ◀───── │ status                        │
└───────────────────────────────────────────────────────────┘        └───────────────────────────────┘
```

- **`src/lib/protocol.ts`** is the single typed contract for worker messages (discriminated unions on both directions, exhaustive `switch` in the worker). Change a message shape and both sides fail to compile.
- **`src/workers/llm.worker.ts`** owns the engine. web-llm is imported *only* here, so its ~6 MB runtime never lands in the main bundle.
- **`src/hooks/useLocalAI.ts`** wraps the worker: load progress, status machine (`idle → loading → ready ⇄ generating`, `error`), live tokens/sec, conversation state and persistence.

### Decisions worth knowing

| Decision | Why |
|---|---|
| Tokens are buffered in a ref and flushed once per `requestAnimationFrame` | Decode can outpace 60 fps; one React commit per token would re-parse Markdown needlessly. |
| `q4f16` vs `q4f32` chosen from `adapter.features.has("shader-f16")` | f16 models fail to load on adapters without `shader-f16`; f32 is the safe fallback. |
| History is trimmed to fit `contextWindow − maxTokens` before each request | Otherwise long chats hit a hard context-overflow error from web-llm. |
| Conversations in IndexedDB, settings in localStorage | History can grow past localStorage's ~5 MB cap; settings must be read synchronously on mount. |
| Model loading is explicit (button), never automatic | A first load downloads 0.7–4.6 GB; that shouldn't happen without consent. |
| Scoped error boundaries around the chat, history and control panels | A render bug in one panel shouldn't unmount the root and drop the worker plus the loaded model's GPU state. |

### Honest limitations

- **"Offline" means after the first load.** Weights are fetched from Hugging Face the first time and cached in the browser's Cache Storage; after that the app works without a network.
- **GPU memory usage isn't observable from the web platform.** The "Est. VRAM" metric is the model's documented requirement; the live memory numbers are JS heap (Chromium only) and origin storage.
- Download sizes in the model picker are approximations; VRAM figures come from web-llm's `prebuiltAppConfig`.

## Project layout

```
src/
  app/                 layout, page (server shell), error + global-error boundaries
  components/
    Chat/              ChatWindow, ChatMessage, ChatInput, CodeBlock
    ClientApp.tsx      client boundary: ErrorBoundary → WebGPUCheck → Playground
    ConversationList.tsx, ErrorBoundary.tsx, ModelSelector.tsx, Sidebar.tsx, WebGPUCheck.tsx
  hooks/               useLocalAI, useMemoryStats
  lib/                 protocol (worker contract), models (catalog), storage, types
  workers/             llm.worker.ts
```
