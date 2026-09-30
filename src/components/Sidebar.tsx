"use client";

import {
  Download,
  Gauge,
  HardDrive,
  LoaderCircle,
  MemoryStick,
  SlidersHorizontal,
  Trash,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemoryStats } from "@/hooks/useMemoryStats";
import type { LocalAI } from "@/hooks/useLocalAI";
import { getModelOption, resolveModelVariant } from "@/lib/models";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { Settings, WebGPUInfo } from "@/lib/types";
import { ModelSelector } from "./ModelSelector";

interface SidebarProps {
  ai: LocalAI;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  gpu: WebGPUInfo;
  onClose?: () => void;
}

function formatMB(mb: number | null) {
  if (mb == null) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

export function Sidebar({ ai, settings, onSettingsChange, gpu, onClose }: SidebarProps) {
  const memory = useMemoryStats();
  const option = getModelOption(settings.modelKey);
  const variant = resolveModelVariant(option, gpu.supportsF16);
  const isLoaded = ai.loadedModelId === variant.id;
  const isLoading = ai.status === "loading";
  const busy = isLoading || ai.status === "generating";

  return (
    <aside className="scroll-thin flex h-full w-full flex-col gap-6 overflow-y-auto bg-surface px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Control panel</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
            aria-label="Close control panel"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* ---------- Model ---------- */}
      <Section icon={<HardDrive className="size-3.5" />} title="Model">
        <ModelSelector
          value={settings.modelKey}
          onChange={(modelKey) => onSettingsChange({ modelKey })}
          supportsF16={gpu.supportsF16}
          cached={ai.cached}
          loadedModelId={ai.loadedModelId}
          disabled={busy}
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => ai.loadModel(settings.modelKey)}
            disabled={busy || isLoaded}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            {isLoaded
              ? "Loaded"
              : isLoading
                ? "Loading…"
                : ai.cached[variant.id]
                  ? "Load from cache"
                  : `Download & load (~${option.approxDownloadGB} GB)`}
          </button>
          {ai.cached[variant.id] && (
            <button
              type="button"
              onClick={() => ai.deleteModelCache(settings.modelKey)}
              disabled={busy}
              className="rounded-lg border border-border px-2.5 text-muted transition hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Delete cached weights for this model"
              title="Delete cached weights"
            >
              <Trash className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {(isLoading || (ai.progress.percent > 0 && ai.progress.percent < 100)) && (
          <div className="mt-3" aria-live="polite">
            <div className="flex justify-between text-xs">
              <span className="text-muted">Loading weights</span>
              <span className="font-mono">{ai.progress.percent}%</span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ai.progress.percent}
              aria-label="Model load progress"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${ai.progress.percent}%` }}
              />
            </div>
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted">
              {ai.progress.text}
            </p>
          </div>
        )}

        {ai.error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
          >
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="flex-1 break-words">{ai.error}</span>
            <button type="button" onClick={ai.dismissError} aria-label="Dismiss error">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-snug text-muted">
          GPU: <span className="text-fg">{gpu.adapterDescription}</span>
          <br />
          Using {gpu.supportsF16 ? "q4f16 (shader-f16 supported)" : "q4f32 (no shader-f16)"}{" "}
          weights.
        </p>
      </Section>

      {/* ---------- Generation ---------- */}
      <Section icon={<SlidersHorizontal className="size-3.5" />} title="Generation">
        <Slider
          label="Temperature"
          value={settings.temperature}
          min={0}
          max={2}
          step={0.05}
          onChange={(temperature) => onSettingsChange({ temperature })}
          hint="Higher = more creative, lower = more deterministic."
        />
        <Slider
          label="Top-p"
          value={settings.topP}
          min={0.05}
          max={1}
          step={0.05}
          onChange={(topP) => onSettingsChange({ topP })}
          hint="Nucleus sampling cutoff."
        />
        <Slider
          label="Max tokens"
          value={settings.maxTokens}
          min={64}
          max={2048}
          step={64}
          onChange={(maxTokens) => onSettingsChange({ maxTokens })}
          format={(v) => v.toFixed(0)}
        />

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="system-prompt" className="text-xs font-medium">
              System prompt
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={settings.useSystemPrompt}
                onChange={(e) => onSettingsChange({ useSystemPrompt: e.target.checked })}
                className="accent-[var(--accent)]"
              />
              Enabled
            </label>
          </div>
          <textarea
            id="system-prompt"
            value={settings.systemPrompt}
            onChange={(e) => onSettingsChange({ systemPrompt: e.target.value })}
            rows={5}
            disabled={!settings.useSystemPrompt}
            className="scroll-thin w-full resize-y rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed focus:border-muted/70 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() =>
              onSettingsChange({
                temperature: DEFAULT_SETTINGS.temperature,
                topP: DEFAULT_SETTINGS.topP,
                maxTokens: DEFAULT_SETTINGS.maxTokens,
                systemPrompt: DEFAULT_SETTINGS.systemPrompt,
                useSystemPrompt: DEFAULT_SETTINGS.useSystemPrompt,
              })
            }
            className="mt-1 text-[11px] text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Reset to defaults
          </button>
        </div>
      </Section>

      {/* ---------- Metrics ---------- */}
      <Section icon={<Gauge className="size-3.5" />} title="Performance">
        <div className="grid grid-cols-2 gap-2">
          <Metric
            label="Tokens / sec"
            value={ai.metrics.tokensPerSec ? ai.metrics.tokensPerSec.toFixed(1) : "—"}
            live={ai.status === "generating"}
          />
          <Metric label="Tokens" value={ai.metrics.tokenCount || "—"} />
          <Metric
            label="Time to first token"
            value={
              ai.metrics.lastStats
                ? `${Math.round(ai.metrics.lastStats.timeToFirstTokenMs)} ms`
                : "—"
            }
          />
          <Metric
            label="Prefill"
            value={
              ai.metrics.lastStats?.prefillTokensPerSec
                ? `${ai.metrics.lastStats.prefillTokensPerSec.toFixed(0)} tok/s`
                : "—"
            }
          />
          <Metric
            label="Model load"
            value={ai.metrics.loadTimeMs ? `${(ai.metrics.loadTimeMs / 1000).toFixed(1)} s` : "—"}
          />
          <Metric label="Est. VRAM" value={formatMB(variant.vramMB)} />
        </div>
      </Section>

      <Section icon={<MemoryStick className="size-3.5" />} title="Memory">
        <dl className="space-y-1.5 text-xs">
          <Row label="JS heap (UI thread)" value={formatMB(memory.jsHeapUsedMB)} />
          <Row
            label="Origin storage (weights cache)"
            value={`${formatMB(memory.storageUsedMB)} / ${formatMB(memory.storageQuotaMB)}`}
          />
        </dl>
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Browsers don&apos;t expose live GPU memory; VRAM above is the model&apos;s documented
          requirement.
        </p>
      </Section>
    </aside>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span aria-hidden>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  format = (v) => v.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
  format?: (v: number) => string;
}) {
  const id = `slider-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="mt-3 first:mt-0">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="font-mono text-muted">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full"
      />
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Metric({ label, value, live }: { label: string; value: ReactNode; live?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10.5px] text-muted">
        {live && <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-mono tabular-nums">{value}</dd>
    </div>
  );
}
