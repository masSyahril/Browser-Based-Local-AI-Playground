"use client";

import { ErrorBoundary } from "./ErrorBoundary";
import { Playground } from "./Playground";
import { WebGPUCheck } from "./WebGPUCheck";

export function ClientApp() {
  return (
    <ErrorBoundary label="the playground">
      <WebGPUCheck>{(gpu) => <Playground gpu={gpu} />}</WebGPUCheck>
    </ErrorBoundary>
  );
}
