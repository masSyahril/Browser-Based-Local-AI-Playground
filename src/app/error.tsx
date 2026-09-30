"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 break-words font-mono text-xs text-muted">{error.message}</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
