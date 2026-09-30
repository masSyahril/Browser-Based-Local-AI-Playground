"use client";

import { LoaderCircle, MonitorX } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { WebGPUInfo } from "@/lib/types";

type CheckState = { phase: "checking" } | { phase: "done"; info: WebGPUInfo };

async function detectWebGPU(): Promise<WebGPUInfo> {
  const unsupported = (reason: string): WebGPUInfo => ({
    supported: false,
    supportsF16: false,
    adapterDescription: "",
    reason,
  });

  if (!window.isSecureContext) {
    return unsupported(
      "WebGPU is only exposed on secure origins. Open this app over HTTPS or on localhost.",
    );
  }
  if (!("gpu" in navigator) || !navigator.gpu) {
    return unsupported(
      "Your browser does not expose the WebGPU API (navigator.gpu is missing).",
    );
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      return unsupported(
        "WebGPU is available, but no compatible GPU adapter was found. Your GPU or driver may be blocklisted, or hardware acceleration is disabled.",
      );
    }
    const { vendor, architecture, description } = adapter.info;
    return {
      supported: true,
      supportsF16: adapter.features.has("shader-f16"),
      adapterDescription:
        description || [vendor, architecture].filter(Boolean).join(" ") || "Unknown GPU",
    };
  } catch (err) {
    return unsupported(
      `Requesting a WebGPU adapter failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Gates its children behind a WebGPU capability probe. Children receive the
 * adapter info so the app can choose f16 vs f32 model variants.
 */
export function WebGPUCheck({
  children,
}: {
  children: (info: WebGPUInfo) => ReactNode;
}) {
  const [state, setState] = useState<CheckState>({ phase: "checking" });

  useEffect(() => {
    let cancelled = false;
    detectWebGPU().then((info) => {
      if (!cancelled) setState({ phase: "done", info });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === "checking") {
    return (
      <div className="flex h-dvh items-center justify-center gap-3 text-muted">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
        <span className="text-sm">Probing your GPU…</span>
      </div>
    );
  }

  if (!state.info.supported) {
    return <UnsupportedScreen reason={state.info.reason ?? ""} />;
  }

  return <>{children(state.info)}</>;
}

function UnsupportedScreen({ reason }: { reason: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <MonitorX className="size-6" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          This browser can&apos;t run local models
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{reason}</p>

        <h2 className="mt-6 text-sm font-medium">What you need</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted">
          <li>
            <span className="text-fg">A WebGPU browser</span> — Chrome or Edge 113+ on
            desktop, Chrome 121+ on Android, Safari 26+, or Firefox 141+ on Windows.
          </li>
          <li>
            <span className="text-fg">A GPU with ~1–6 GB of free memory</span>, depending on
            the model. Integrated GPUs work for the 1B–3B models.
          </li>
          <li>
            <span className="text-fg">Hardware acceleration enabled</span> in browser
            settings. Check <code className="font-mono text-xs">chrome://gpu</code> for
            &ldquo;WebGPU: Hardware accelerated&rdquo;.
          </li>
        </ul>

        <p className="mt-6 text-xs text-muted">
          Nothing was downloaded. Once your browser supports WebGPU, reload this page.
        </p>
      </div>
    </main>
  );
}
