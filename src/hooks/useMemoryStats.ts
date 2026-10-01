"use client";

import { useEffect, useState } from "react";

export interface MemoryStats {
  /** Chromium-only; null elsewhere. */
  jsHeapUsedMB: number | null;
  /** Origin storage used (dominated by cached model weights). */
  storageUsedMB: number | null;
  storageQuotaMB: number | null;
}

const MB = 1024 * 1024;

/**
 * Browsers don't expose GPU memory usage, so we report what *is* observable:
 * JS heap (main thread) and origin storage (the weights cache). VRAM is shown
 * separately as the model's documented requirement.
 */
export function useMemoryStats(intervalMs = 2000): MemoryStats {
  const [stats, setStats] = useState<MemoryStats>({
    jsHeapUsedMB: null,
    storageUsedMB: null,
    storageQuotaMB: null,
  });

  useEffect(() => {
    let cancelled = false;

    const sample = async () => {
      const heap = performance.memory?.usedJSHeapSize;
      let usage: number | undefined;
      let quota: number | undefined;
      try {
        ({ usage, quota } = await navigator.storage.estimate());
      } catch {
        /* storage API unavailable */
      }
      if (cancelled) return;
      setStats({
        jsHeapUsedMB: heap != null ? heap / MB : null,
        storageUsedMB: usage != null ? usage / MB : null,
        storageQuotaMB: quota != null ? quota / MB : null,
      });
    };

    void sample();
    const id = setInterval(sample, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return stats;
}
