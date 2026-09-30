"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Human-readable name of the region, shown in the fallback. */
  label: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Scoped error boundary. A malformed markdown payload or a bad render in one
 * panel shouldn't take down the whole app (and the loaded model with it —
 * remounting the root would terminate the worker and drop GBs of GPU state).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm"
      >
        <div className="flex items-center gap-2 font-medium text-danger">
          <TriangleAlert className="size-4" aria-hidden />
          Something went wrong in {this.props.label}.
        </div>
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs transition hover:bg-surface-2"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Try again
        </button>
      </div>
    );
  }
}
