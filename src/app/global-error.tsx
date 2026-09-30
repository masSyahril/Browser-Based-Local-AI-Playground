"use client";

// Replaces the root layout when it throws, so it can't rely on globals.css.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0c0d0c",
          color: "#ececea",
        }}
      >
        <title>Error · Local AI Playground</title>
        <div style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 18 }}>The app failed to start</h1>
          <p style={{ fontSize: 13, opacity: 0.7, wordBreak: "break-word" }}>{error.message}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              padding: "8px 12px",
              borderRadius: 8,
              border: 0,
              background: "#a3e635",
              color: "#0c0d0c",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
