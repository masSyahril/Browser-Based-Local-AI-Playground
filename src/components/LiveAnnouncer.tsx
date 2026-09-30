"use client";

import { useEffect, useRef, useState } from "react";
import type { EngineStatus } from "@/lib/types";

/**
 * Screen-reader announcements for state changes that are otherwise only
 * visual: model ready, response finished/stopped, errors. Streaming tokens are
 * deliberately *not* announced — reading every token aloud is unusable.
 */
export function LiveAnnouncer({
  status,
  modelLabel,
  error,
}: {
  status: EngineStatus;
  modelLabel: string | null;
  error: string | null;
}) {
  const [message, setMessage] = useState("");
  const prev = useRef<EngineStatus>(status);

  useEffect(() => {
    const from = prev.current;
    prev.current = status;
    let next = "";
    if (from === "loading" && status === "ready") next = `${modelLabel ?? "Model"} loaded and ready.`;
    else if (from === "generating" && status === "ready") next = "Response complete.";
    else if (status === "generating" && from !== "generating") next = "Generating response…";
    if (!next) return;
    const id = setTimeout(() => setMessage(next), 50);
    return () => clearTimeout(id);
  }, [status, modelLabel]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
      <div aria-live="assertive" className="sr-only">
        {error}
      </div>
    </>
  );
}
