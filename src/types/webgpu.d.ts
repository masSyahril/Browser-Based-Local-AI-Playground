/// <reference types="@webgpu/types" />

// Non-standard Chromium API used for the JS heap metric.
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface Performance {
  memory?: PerformanceMemory;
}
